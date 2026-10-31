-- =============================================================================
-- 0011_domain_verification.sql – CampusShare / EquipSync
-- Email Domain Auto-Verification, Domain Management RPCs, Terminology Normalization
-- =============================================================================

-- ===========================================================================
-- SECTION 1: SCHEMA EXTENSIONS (institutions & profiles)
-- ===========================================================================

-- 1. Add allowed_domains text[] to institutions
alter table public.institutions
  add column if not exists allowed_domains text[] not null default '{}';

create index if not exists idx_institutions_allowed_domains_gin
  on public.institutions using gin (allowed_domains);

-- 2. Add verification_method and verified_at to profiles
alter table public.profiles
  add column if not exists verification_method text check (verification_method in ('admin', 'domain')),
  add column if not exists verified_at timestamptz;

-- 3. Update existing verified profiles to have verified_at populated
update public.profiles
set verified_at = created_at
where verification_status = 'verified' and verified_at is null;

-- ===========================================================================
-- SECTION 2: DOMAIN NORMALIZATION IMMUTABLE HELPER
-- ===========================================================================

create or replace function public.normalize_domain(p_input text)
returns text
language plpgsql
immutable
as $$
declare
  d text;
  core text;
  tld text;
  labels text[];
begin
  if p_input is null then
    return null;
  end if;

  d := lower(trim(p_input));

  -- Strip leading '@'
  if d like '@%' then
    d := substr(d, 2);
  end if;
  d := trim(d);

  if d = '' or d ~ '[\s_]' then
    return null;
  end if;

  -- Extract core domain to validate syntax
  if d like '*.%' then
    core := substr(d, 3);
  else
    core := d;
  end if;

  -- Strict domain syntax: labels 1-63 chars [a-z0-9-], not starting or ending with hyphen
  if core !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' then
    return null;
  end if;

  labels := string_to_array(core, '.');
  tld := labels[array_length(labels, 1)];

  -- Reject numeric TLDs (IPv4-like addresses)
  if tld ~ '^\d+$' then
    return null;
  end if;

  return d;
end;
$$;

-- ===========================================================================
-- SECTION 3: DOMAIN VALIDATION TRIGGER ON institutions
-- ===========================================================================

create or replace function public.trg_validate_allowed_domains()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm_list     text[] := '{}';
  v_entry         text;
  v_normalized    text;
  v_core          text;
  v_other_inst    record;
  v_other_entry   text;
  v_other_core    text;
  v_public_providers text[] := array[
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in',
    'outlook.com', 'hotmail.com', 'live.com', 'msn.com', 'icloud.com',
    'me.com', 'aol.com', 'proton.me', 'protonmail.com', 'zoho.com',
    'rediffmail.com', 'mail.com', 'gmx.com', 'yandex.com'
  ];
begin
  if NEW.allowed_domains is null or array_length(NEW.allowed_domains, 1) is null then
    NEW.allowed_domains := '{}';
    return NEW;
  end if;

  -- At most 20 domains per organization
  if array_length(NEW.allowed_domains, 1) > 20 then
    raise exception 'invalid_domains: at most 20 domains allowed per organization';
  end if;

  -- Normalize and deduplicate entries
  foreach v_entry in array NEW.allowed_domains
  loop
    v_normalized := public.normalize_domain(v_entry);
    if v_normalized is null then
      raise exception 'invalid_domain: %', v_entry;
    end if;

    -- Extract core domain
    if v_normalized like '*.%' then
      v_core := substr(v_normalized, 3);
    else
      v_core := v_normalized;
    end if;

    -- Reject public email providers
    if v_core = any(v_public_providers) then
      raise exception 'domain_not_allowed: public email providers cannot be claimed (%)', v_core;
    end if;

    if not (v_normalized = any(v_norm_list)) then
      v_norm_list := array_append(v_norm_list, v_normalized);
    end if;
  end loop;

  NEW.allowed_domains := v_norm_list;

  -- Check collision with domains claimed by other organizations
  for v_other_inst in
    select id, allowed_domains
    from public.institutions
    where id <> NEW.id and array_length(allowed_domains, 1) > 0
  loop
    foreach v_other_entry in array v_other_inst.allowed_domains
    loop
      if v_other_entry like '*.%' then
        v_other_core := substr(v_other_entry, 3);
      else
        v_other_core := v_other_entry;
      end if;

      foreach v_normalized in array NEW.allowed_domains
      loop
        if v_normalized like '*.%' then
          v_core := substr(v_normalized, 3);
        else
          v_core := v_normalized;
        end if;

        -- Check exact match collision
        if v_normalized = v_other_entry or v_core = v_other_core then
          raise exception 'domain_already_claimed';
        end if;

        -- Check wildcard sub-domain overlapping collision
        if v_other_entry like '*.%' and (v_core = v_other_core or right(v_core, length(v_other_core) + 1) = '.' || v_other_core) then
          raise exception 'domain_already_claimed';
        end if;

        if v_normalized like '*.%' and (v_other_core = v_core or right(v_other_core, length(v_core) + 1) = '.' || v_core) then
          raise exception 'domain_already_claimed';
        end if;
      end loop;
    end loop;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists trg_institutions_validate_allowed_domains on public.institutions;
create trigger trg_institutions_validate_allowed_domains
  before insert or update of allowed_domains on public.institutions
  for each row execute function public.trg_validate_allowed_domains();

-- ===========================================================================
-- SECTION 4: PERMISSIONS ON institutions
-- ===========================================================================

-- Revoke broad UPDATE on institutions from authenticated
revoke update on public.institutions from authenticated;

-- Grant selective UPDATE only on non-sensitive columns
grant update (name, type, address) on public.institutions to authenticated;

-- ===========================================================================
-- SECTION 5: INTERNAL DOMAIN AUTO-VERIFICATION HELPER
-- ===========================================================================

create or replace function public.apply_domain_verification(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_email       text;
  v_email_confirmed  timestamptz;
  v_profile          public.profiles%rowtype;
  v_domain           text;
  v_matched_inst     record;
  v_match_count      int := 0;
  v_matched_entry    text;
  v_inst_row         record;
  v_entry            text;
  v_suffix           text;
begin
  select email, email_confirmed_at into v_user_email, v_email_confirmed
  from auth.users
  where id = p_user_id;

  if v_user_email is null or v_email_confirmed is null then
    return false;
  end if;

  select * into v_profile
  from public.profiles
  where id = p_user_id;

  -- Only acts on role 'member' whose status is 'pending'
  if v_profile.id is null or v_profile.role <> 'member' or v_profile.verification_status <> 'pending' then
    return false;
  end if;

  v_domain := public.normalize_domain(split_part(v_user_email, '@', 2));
  if v_domain is null then
    return false;
  end if;

  -- Evaluate matching organizations
  for v_inst_row in
    select id, name, allowed_domains
    from public.institutions
    where array_length(allowed_domains, 1) > 0
  loop
    foreach v_entry in array v_inst_row.allowed_domains
    loop
      if v_entry = v_domain then
        v_match_count   := v_match_count + 1;
        v_matched_inst  := v_inst_row;
        v_matched_entry := v_entry;
        exit;
      elsif v_entry like '*.%' then
        v_suffix := substr(v_entry, 3);
        if right(v_domain, length(v_suffix) + 1) = '.' || v_suffix then
          v_match_count   := v_match_count + 1;
          v_matched_inst  := v_inst_row;
          v_matched_entry := v_entry;
          exit;
        end if;
      end if;
    end loop;
  end loop;

  -- If zero matches or ambiguous match (> 1), do nothing
  if v_match_count <> 1 then
    return false;
  end if;

  -- If profile's institution_id is null or equals match, auto-verify
  if v_profile.institution_id is null or v_profile.institution_id = v_matched_inst.id then
    update public.profiles
    set institution_id      = v_matched_inst.id,
        verification_status = 'verified',
        verification_method = 'domain',
        verified_at         = now(),
        updated_at          = now()
    where id = p_user_id;

    insert into public.audit_log (
      institution_id, actor_id, action, entity_type, entity_id, metadata
    ) values (
      v_matched_inst.id,
      p_user_id,
      'member.auto_verified',
      'profile',
      p_user_id,
      jsonb_build_object('domain', v_domain, 'matched_entry', v_matched_entry)
    );

    perform public.notify(
      p_user_id,
      'membership_verified',
      'Organization Verified',
      format('You''ve been verified automatically for %s through your %s email address.', v_matched_inst.name, v_domain),
      '/app/user'
    );

    return true;
  end if;

  return false;
end;
$$;

revoke execute on function public.apply_domain_verification(uuid) from public, anon, authenticated;

-- ===========================================================================
-- SECTION 6: RPC set_allowed_domains & get_my_org_domains
-- ===========================================================================

create or replace function public.get_my_org_domains()
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id  uuid;
  v_inst_id    uuid;
  v_domains    text[];
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  v_inst_id := public.current_institution_id();
  if v_inst_id is null or not public.is_institution_admin(v_inst_id) then
    raise exception 'forbidden';
  end if;

  select allowed_domains into v_domains
  from public.institutions
  where id = v_inst_id;

  return coalesce(v_domains, '{}'::text[]);
end;
$$;

create or replace function public.set_allowed_domains(p_domains text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id       uuid;
  v_caller_email    text;
  v_email_confirmed timestamptz;
  v_caller_domain   text;
  v_inst_id         uuid;
  v_clean_domains   text[] := '{}';
  v_item            text;
  v_normalized      text;
  v_core            text;
  v_newly_verified  int := 0;
  v_profile         record;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  select email, email_confirmed_at into v_caller_email, v_email_confirmed
  from auth.users
  where id = v_caller_id;

  if v_email_confirmed is null then
    raise exception 'forbidden: email not confirmed';
  end if;

  v_inst_id := public.current_institution_id();
  if v_inst_id is null or not public.is_institution_admin(v_inst_id) then
    raise exception 'forbidden';
  end if;

  v_caller_domain := public.normalize_domain(split_part(v_caller_email, '@', 2));
  if v_caller_domain is null then
    raise exception 'domain_not_provable';
  end if;

  -- Validate each entry against caller confirmed domain
  if p_domains is not null then
    foreach v_item in array p_domains
    loop
      v_normalized := public.normalize_domain(v_item);
      if v_normalized is null then
        raise exception 'invalid_domain: %', v_item;
      end if;

      if v_normalized like '*.%' then
        v_core := substr(v_normalized, 3);
      else
        v_core := v_normalized;
      end if;

      -- Must equal confirmed domain, be subdomain, or be *. plus domain
      if not (v_core = v_caller_domain or right(v_core, length(v_caller_domain) + 1) = '.' || v_caller_domain) then
        raise exception 'domain_not_provable';
      end if;

      if not (v_normalized = any(v_clean_domains)) then
        v_clean_domains := array_append(v_clean_domains, v_normalized);
      end if;
    end loop;
  end if;

  -- Update organization allowed domains
  update public.institutions
  set allowed_domains = v_clean_domains,
      updated_at = now()
  where id = v_inst_id;

  insert into public.audit_log (
    institution_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_inst_id,
    v_caller_id,
    'org.domains_updated',
    'institution',
    v_inst_id,
    jsonb_build_object('domains', v_clean_domains)
  );

  -- Re-evaluate pending members that belong to this organization or have matching domain
  for v_profile in
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'member'
      and p.verification_status = 'pending'
      and u.email_confirmed_at is not null
      and (p.institution_id = v_inst_id or p.institution_id is null)
  loop
    if public.apply_domain_verification(v_profile.id) then
      v_newly_verified := v_newly_verified + 1;
    end if;
  end loop;

  return jsonb_build_object(
    'domains', v_clean_domains,
    'newly_verified', v_newly_verified
  );
end;
$$;

-- ===========================================================================
-- SECTION 7: match_organization_by_email (Public RPC)
-- ===========================================================================

create or replace function public.match_organization_by_email(p_email text)
returns table (id uuid, name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_domain     text;
  v_match_id   uuid;
  v_match_name text;
  v_count      int := 0;
  v_row        record;
  v_entry      text;
  v_suffix     text;
begin
  if p_email is null or not (p_email like '%@%') then
    return;
  end if;

  v_domain := public.normalize_domain(split_part(p_email, '@', 2));
  if v_domain is null then
    return;
  end if;

  for v_row in
    select i.id, i.name, i.allowed_domains
    from public.institutions i
    where array_length(i.allowed_domains, 1) > 0
  loop
    foreach v_entry in array v_row.allowed_domains
    loop
      if v_entry = v_domain then
        v_count      := v_count + 1;
        v_match_id   := v_row.id;
        v_match_name := v_row.name;
        exit;
      elsif v_entry like '*.%' then
        v_suffix := substr(v_entry, 3);
        if right(v_domain, length(v_suffix) + 1) = '.' || v_suffix then
          v_count      := v_count + 1;
          v_match_id   := v_row.id;
          v_match_name := v_row.name;
          exit;
        end if;
      end if;
    end loop;
  end loop;

  -- Only expose result if exactly one unique match found
  if v_count = 1 then
    id   := v_match_id;
    name := v_match_name;
    return next;
  end if;
end;
$$;

-- ===========================================================================
-- SECTION 8: AUTH TRIGGERS ON auth.users
-- ===========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role           text;
  v_full_name      text;
  v_user_type      text;
  v_institution_id uuid;
  v_inst_name      text;
  v_inst_type      text;
  v_email_domain   text;
  v_new_inst_id    uuid;
  v_valid_inst_id  uuid := null;
begin
  v_role           := new.raw_user_meta_data ->> 'role';
  v_full_name      := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_user_type      := new.raw_user_meta_data ->> 'user_type';
  v_inst_name      := new.raw_user_meta_data ->> 'institution_name';
  v_inst_type      := new.raw_user_meta_data ->> 'institution_type';
  v_email_domain   := new.raw_user_meta_data ->> 'email_domain';

  -- Safely parse institution_id if provided
  begin
    if (new.raw_user_meta_data ->> 'institution_id') is not null then
      v_institution_id := (new.raw_user_meta_data ->> 'institution_id')::uuid;
      select id into v_valid_inst_id
      from public.institutions
      where id = v_institution_id;
    end if;
  exception when others then
    v_valid_inst_id := null;
  end;

  if v_role = 'institution_admin' and v_inst_name is not null and trim(v_inst_name) <> '' then
    insert into public.institutions(name, type, email_domain, created_by)
    values (
      v_inst_name,
      coalesce(v_inst_type, 'university'),
      v_email_domain,
      new.id
    )
    returning id into v_new_inst_id;

    insert into public.profiles(
      id, institution_id, full_name, role, user_type, verification_status, verification_method, verified_at
    ) values (
      new.id,
      v_new_inst_id,
      v_full_name,
      'institution_admin',
      coalesce(v_user_type::public.user_type, 'staff'),
      'verified',
      'admin',
      now()
    )
    on conflict (id) do update set
      institution_id      = excluded.institution_id,
      full_name           = excluded.full_name,
      role                = excluded.role,
      user_type           = excluded.user_type,
      verification_status = 'verified',
      verification_method = 'admin',
      verified_at         = now();

  else
    -- Default to member profile; verification starts as 'pending'
    insert into public.profiles(
      id, institution_id, full_name, role, user_type, verification_status
    ) values (
      new.id,
      v_valid_inst_id,
      v_full_name,
      'member',
      coalesce(v_user_type::public.user_type, 'student'),
      'pending'
    )
    on conflict (id) do update set
      institution_id      = coalesce(excluded.institution_id, public.profiles.institution_id),
      full_name           = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
      role                = 'member',
      user_type           = coalesce(excluded.user_type, public.profiles.user_type);

    -- If email is already confirmed at creation, attempt auto-verification
    if new.email_confirmed_at is not null then
      perform public.apply_domain_verification(new.id);
    end if;
  end if;

  return new;
exception
  when others then
    insert into public.profiles(
      id, institution_id, full_name, role, user_type, verification_status
    ) values (
      new.id,
      null,
      coalesce(new.raw_user_meta_data ->> 'full_name', ''),
      'member',
      'student',
      'pending'
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

create or replace function public.trg_on_auth_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if OLD.email_confirmed_at is null and NEW.email_confirmed_at is not null then
    perform public.apply_domain_verification(NEW.id);
  end if;
  return NEW;
end;
$$;

drop trigger if exists on_auth_user_email_confirmed on auth.users;
create trigger on_auth_user_email_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (OLD.email_confirmed_at is null and NEW.email_confirmed_at is not null)
  execute function public.trg_on_auth_email_confirmed();

-- ===========================================================================
-- SECTION 9: RE-CREATE verify_member & UPDATE NOTIFICATIONS
-- ===========================================================================

create or replace function public.verify_member(
  p_user_id uuid,
  p_approve boolean
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id    uuid;
  v_admin_inst   uuid;
  v_target_inst  uuid;
  v_updated_prof public.profiles%rowtype;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  v_admin_inst := public.current_institution_id();
  if v_admin_inst is null or not public.is_institution_admin(v_admin_inst) then
    raise exception 'forbidden';
  end if;

  select institution_id into v_target_inst
  from public.profiles
  where id = p_user_id;

  if not found then
    raise exception 'not_found';
  end if;

  if v_target_inst is null or v_target_inst <> v_admin_inst then
    raise exception 'forbidden';
  end if;

  update public.profiles
  set verification_status = case when p_approve then 'verified' else 'rejected' end,
      verification_method = case when p_approve then 'admin' else null end,
      verified_at         = case when p_approve then now() else null end,
      updated_at          = now()
  where id = p_user_id
  returning * into v_updated_prof;

  insert into public.audit_log (
    institution_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_admin_inst,
    v_caller_id,
    case when p_approve then 'member.verified' else 'member.rejected' end,
    'profile',
    p_user_id,
    jsonb_build_object('method', 'admin', 'status', v_updated_prof.verification_status)
  );

  perform public.notify(
    p_user_id,
    'verification_update',
    case when p_approve then 'Membership Approved' else 'Membership Declined' end,
    case
      when p_approve then 'Your organization membership has been verified by an administrator.'
      else 'Your organization membership verification was declined.'
    end,
    '/app/user'
  );

  return v_updated_prof;
end;
$$;

-- Notification copy update on existing records
update public.notifications
set title = replace(title, 'institution', 'organization'),
    body  = replace(body, 'institution', 'organization')
where title ilike '%institution%' or body ilike '%institution%';

-- ===========================================================================
-- SECTION 10: BACKFILL & RETROACTIVE AUTO-VERIFICATION
-- ===========================================================================

do $$
declare
  r_inst        record;
  r_admin       record;
  v_norm_dom    text;
  v_inst_count  int := 0;
  v_auto_count  int := 0;
  r_pending     record;
begin
  for r_inst in
    select i.id, i.email_domain
    from public.institutions i
    where i.email_domain is not null and trim(i.email_domain) <> ''
  loop
    v_norm_dom := public.normalize_domain(r_inst.email_domain);

    -- Check if organization admin has confirmed email matching domain
    select u.id into r_admin
    from auth.users u
    join public.profiles p on p.id = u.id
    where p.institution_id = r_inst.id
      and p.role = 'institution_admin'
      and u.email_confirmed_at is not null
      and (
        public.normalize_domain(split_part(u.email, '@', 2)) = v_norm_dom
        or right(public.normalize_domain(split_part(u.email, '@', 2)), length(v_norm_dom) + 1) = '.' || v_norm_dom
      )
    limit 1;

    if r_admin.id is not null and v_norm_dom is not null then
      update public.institutions
      set allowed_domains = array[v_norm_dom]
      where id = r_inst.id and array_length(allowed_domains, 1) = 0;
      v_inst_count := v_inst_count + 1;
    end if;
  end loop;

  -- Run retroactive verification for pending members
  for r_pending in
    select p.id
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.role = 'member'
      and p.verification_status = 'pending'
      and u.email_confirmed_at is not null
  loop
    if public.apply_domain_verification(r_pending.id) then
      v_auto_count := v_auto_count + 1;
    end if;
  end loop;

  raise notice 'Backfill completed: % institutions updated with verified domains; % pending members auto-verified.', v_inst_count, v_auto_count;
end $$;

-- ===========================================================================
-- SECTION 11: GRANTS & RELOAD
-- ===========================================================================

revoke execute on function public.set_allowed_domains(text[]) from public, anon;
grant execute on function public.set_allowed_domains(text[]) to authenticated;

revoke execute on function public.get_my_org_domains() from public, anon;
grant execute on function public.get_my_org_domains() to authenticated;

revoke execute on function public.verify_member(uuid, boolean) from public, anon;
grant execute on function public.verify_member(uuid, boolean) to authenticated;

revoke execute on function public.match_organization_by_email(text) from public;
grant execute on function public.match_organization_by_email(text) to anon, authenticated;

notify pgrst, 'reload schema';
