-- =============================================================================
-- 0013_enterprise_b2b_workflow.sql
-- EquipSync - Enterprise Multi-Tenant B2B Workflow, Hardened Approval Pipeline,
-- Organization Verification, and Tenant Isolation Hardening.
-- Postgres 15 on Supabase.
-- =============================================================================

-- =============================================================================
-- SECTION 1: SCHEMA EXTENSIONS (institutions & profiles)
-- =============================================================================

-- 1. Add B2B profile columns to institutions
alter table public.institutions
  add column if not exists website_url      text,
  add column if not exists contact_phone    text,
  add column if not exists registration_id  text,
  add column if not exists status           text not null default 'active'
    check (status in ('pending_email', 'active')),
  add column if not exists domain_proof     boolean not null default false;

-- 2. Add job_title to profiles
alter table public.profiles
  add column if not exists job_title        text;

-- Backfill existing rows to active status
update public.institutions
set status = 'active'
where status is null or status <> 'active';

-- Re-grant UPDATE on profiles to include job_title
grant update(full_name, avatar_url, job_title) on public.profiles to authenticated;

-- =============================================================================
-- SECTION 2: NAME INTEGRITY & AVAILABILITY CHECK
-- =============================================================================

-- Immutable normalization helper for names
create or replace function public.normalize_organization_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g'));
$$;

-- Unique partial index on normalized name for active organizations
create unique index if not exists idx_institutions_normalized_active_name
  on public.institutions (public.normalize_organization_name(name))
  where (status = 'active');

-- Trigger to reject active duplicates with 'organization_exists'
create or replace function public.trg_check_institution_name()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm text;
begin
  if NEW.status = 'active' then
    v_norm := public.normalize_organization_name(NEW.name);
    if v_norm = '' then
      raise exception 'invalid_organization_name';
    end if;

    if exists (
      select 1
      from public.institutions
      where public.normalize_organization_name(name) = v_norm
        and id <> coalesce(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and status = 'active'
    ) then
      raise exception 'organization_exists';
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_institutions_check_name on public.institutions;
create trigger trg_institutions_check_name
  before insert or update of name, status on public.institutions
  for each row execute function public.trg_check_institution_name();

-- RPC organization_name_available (Rate-limit friendly, returns only boolean)
create or replace function public.organization_name_available(p_name text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_norm text;
begin
  if p_name is null then
    return false;
  end if;

  v_norm := public.normalize_organization_name(p_name);
  if length(v_norm) < 3 or length(v_norm) > 120 then
    return false;
  end if;

  return not exists (
    select 1
    from public.institutions
    where public.normalize_organization_name(name) = v_norm
      and status = 'active'
  );
end;
$$;

revoke execute on function public.organization_name_available(text) from public;
grant execute on function public.organization_name_available(text) to anon, authenticated;

-- =============================================================================
-- SECTION 3: EXTENDED handle_new_user TRIGGER WITH VALIDATION
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role            text;
  v_full_name       text;
  v_user_type       text;
  v_institution_id  uuid;
  v_inst_name       text;
  v_inst_type       text;
  v_email_domain    text;
  v_website_url     text;
  v_contact_phone   text;
  v_registration_id text;
  v_job_title       text;
  v_new_inst_id     uuid;
  v_valid_inst_id   uuid := null;
  v_inst_status     text;
  v_domain_proof    boolean := false;
  v_clean_web       text;
  v_web_host        text;
  v_norm_type       text;
  v_allowed_types   text[] := array[
    'university', 'college', 'school', 'corporate', 'makerspace',
    'workshop', 'shop', 'community lab', 'research institute', 'other'
  ];
begin
  v_role            := new.raw_user_meta_data ->> 'role';
  v_full_name       := regexp_replace(coalesce(new.raw_user_meta_data ->> 'full_name', ''), '[\x00-\x1f\x7f]', '', 'g');
  v_user_type       := new.raw_user_meta_data ->> 'user_type';
  v_inst_name       := regexp_replace(coalesce(new.raw_user_meta_data ->> 'institution_name', ''), '[\x00-\x1f\x7f]', '', 'g');
  v_inst_type       := regexp_replace(coalesce(new.raw_user_meta_data ->> 'institution_type', ''), '[\x00-\x1f\x7f]', '', 'g');
  v_email_domain    := new.raw_user_meta_data ->> 'email_domain';
  v_website_url     := regexp_replace(coalesce(new.raw_user_meta_data ->> 'website_url', ''), '[\x00-\x1f\x7f]', '', 'g');
  v_contact_phone   := regexp_replace(coalesce(new.raw_user_meta_data ->> 'contact_phone', ''), '[\x00-\x1f\x7f]', '', 'g');
  v_registration_id := regexp_replace(coalesce(new.raw_user_meta_data ->> 'registration_id', ''), '[\x00-\x1f\x7f]', '', 'g');
  v_job_title       := regexp_replace(coalesce(new.raw_user_meta_data ->> 'job_title', ''), '[\x00-\x1f\x7f]', '', 'g');

  -- Safely parse institution_id if provided (must be an active organization)
  begin
    if (new.raw_user_meta_data ->> 'institution_id') is not null then
      v_institution_id := (new.raw_user_meta_data ->> 'institution_id')::uuid;
      select id into v_valid_inst_id
      from public.institutions
      where id = v_institution_id and status = 'active';
    end if;
  exception when others then
    v_valid_inst_id := null;
  end;

  -- -------------------------------------------------------------------------
  -- Path A: Institution Admin Onboarding
  -- -------------------------------------------------------------------------
  if v_role = 'institution_admin' and v_inst_name is not null and trim(v_inst_name) <> '' then
    -- 1. Validate Organization Name (3 to 120 chars)
    if length(trim(v_inst_name)) < 3 or length(trim(v_inst_name)) > 120 then
      raise exception 'invalid_organization_name';
    end if;

    -- 2. Validate Organization Type
    v_norm_type := lower(trim(v_inst_type));
    if not (v_norm_type = any(v_allowed_types)) then
      raise exception 'invalid_organization_type';
    end if;

    -- 3. Validate Website URL (normalize to https://)
    v_clean_web := trim(v_website_url);
    if v_clean_web <> '' then
      if not (v_clean_web ~* '^https?://') then
        v_clean_web := 'https://' || v_clean_web;
      elsif v_clean_web ~* '^http://' then
        v_clean_web := 'https://' || substr(v_clean_web, 8);
      end if;

      if not (v_clean_web ~* '^https://([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(/.*)?$') then
        raise exception 'invalid_website';
      end if;
    else
      raise exception 'invalid_website';
    end if;

    -- 4. Validate Contact Phone
    if not (trim(v_contact_phone) ~* '^\+?[0-9 ()-]{7,20}$') then
      raise exception 'invalid_phone';
    end if;

    -- 5. Validate Job Title (2 to 80 chars)
    if length(trim(v_job_title)) < 2 or length(trim(v_job_title)) > 80 then
      raise exception 'invalid_job_title';
    end if;

    -- 6. Validate Registration ID (optional, max 40 chars of letters, digits, spaces and -/.)
    if trim(v_registration_id) <> '' then
      if length(trim(v_registration_id)) > 40 or not (trim(v_registration_id) ~* '^[a-zA-Z0-9 -/.]+$') then
        raise exception 'invalid_registration_id';
      end if;
    else
      v_registration_id := null;
    end if;

    -- Status logic: pending_email unless email already confirmed
    if new.email_confirmed_at is not null then
      v_inst_status := 'active';

      -- Check duplicate active organization
      if exists (
        select 1 from public.institutions
        where public.normalize_organization_name(name) = public.normalize_organization_name(v_inst_name)
          and status = 'active'
      ) then
        raise exception 'organization_exists';
      end if;

      -- Calculate domain proof
      v_web_host := lower(regexp_replace(v_clean_web, '^https://([^/:]+).*$', '\1'));
      v_email_domain := public.normalize_domain(split_part(new.email, '@', 2));

      if v_email_domain is not null
         and not (v_email_domain in (
           'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
           'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
           'icloud.com', 'me.com', 'aol.com', 'proton.me',
           'protonmail.com', 'zoho.com', 'mail.com', 'gmx.com', 'yandex.com'
         ))
         and (
           v_email_domain = v_web_host
           or right(v_email_domain, length(v_web_host) + 1) = '.' || v_web_host
           or right(v_web_host, length(v_email_domain) + 1) = '.' || v_email_domain
         )
      then
        v_domain_proof := true;
      end if;
    else
      v_inst_status := 'pending_email';
      v_domain_proof := false;
    end if;

    insert into public.institutions(
      name, type, email_domain, website_url, contact_phone, registration_id, status, domain_proof, created_by
    ) values (
      v_inst_name,
      v_inst_type,
      v_email_domain,
      v_clean_web,
      trim(v_contact_phone),
      trim(v_registration_id),
      v_inst_status,
      v_domain_proof,
      new.id
    )
    returning id into v_new_inst_id;

    insert into public.profiles(
      id, institution_id, full_name, role, user_type, verification_status, verification_method, verified_at, job_title
    ) values (
      new.id,
      v_new_inst_id,
      v_full_name,
      'institution_admin',
      coalesce(v_user_type::public.user_type, 'staff'),
      'verified',
      'admin',
      now(),
      trim(v_job_title)
    )
    on conflict (id) do update set
      institution_id      = excluded.institution_id,
      full_name           = excluded.full_name,
      role                = excluded.role,
      user_type           = excluded.user_type,
      verification_status = 'verified',
      verification_method = 'admin',
      verified_at         = now(),
      job_title           = excluded.job_title;

  -- -------------------------------------------------------------------------
  -- Path B: Member Onboarding
  -- -------------------------------------------------------------------------
  else
    -- Default to member profile; verification starts as 'pending'
    insert into public.profiles(
      id, institution_id, full_name, role, user_type, verification_status, job_title
    ) values (
      new.id,
      v_valid_inst_id,
      v_full_name,
      'member',
      coalesce(v_user_type::public.user_type, 'student'),
      'pending',
      trim(v_job_title)
    )
    on conflict (id) do update set
      institution_id      = coalesce(excluded.institution_id, public.profiles.institution_id),
      full_name           = case when excluded.full_name <> '' then excluded.full_name else public.profiles.full_name end,
      role                = 'member',
      user_type           = coalesce(excluded.user_type, public.profiles.user_type),
      job_title           = coalesce(excluded.job_title, public.profiles.job_title);

    -- If email is already confirmed at creation, attempt auto-verification
    if new.email_confirmed_at is not null then
      perform public.apply_domain_verification(new.id);
    end if;
  end if;

  return new;
exception
  when others then
    -- If custom exception raised during validation, re-raise it for frontend
    if SQLERRM in (
      'invalid_organization_name', 'invalid_organization_type', 'invalid_website',
      'invalid_phone', 'invalid_job_title', 'invalid_registration_id', 'organization_exists'
    ) then
      raise exception '%', SQLERRM;
    end if;

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

-- =============================================================================
-- SECTION 4: ACTIVATION & DOMAIN PROOF ON EMAIL CONFIRMATION
-- =============================================================================

create or replace function public.trg_on_auth_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prof         record;
  v_inst         record;
  v_web_host     text;
  v_email_domain text;
  v_domain_proof boolean := false;
  v_earliest_id  uuid;
begin
  if OLD.email_confirmed_at is null and NEW.email_confirmed_at is not null then
    select * into v_prof
    from public.profiles
    where id = NEW.id;

    if v_prof.id is not null and v_prof.role = 'institution_admin' and v_prof.institution_id is not null then
      select * into v_inst
      from public.institutions
      where id = v_prof.institution_id;

      if v_inst.id is not null and v_inst.status = 'pending_email' then
        -- Check if activating would collide with an already active organization
        select id into v_earliest_id
        from public.institutions
        where public.normalize_organization_name(name) = public.normalize_organization_name(v_inst.name)
          and status = 'active'
          and id <> v_inst.id
        limit 1;

        if v_earliest_id is not null then
          -- Collision exists: keep pending without leaving half-activated state
          raise exception 'organization_exists';
        end if;

        -- Check domain proof
        if v_inst.website_url is not null and v_inst.website_url <> '' then
          v_web_host := lower(regexp_replace(v_inst.website_url, '^https?://([^/:]+).*$', '\1'));
          v_email_domain := public.normalize_domain(split_part(NEW.email, '@', 2));

          if v_email_domain is not null
             and not (v_email_domain in (
               'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
               'outlook.com', 'hotmail.com', 'live.com', 'msn.com',
               'icloud.com', 'me.com', 'aol.com', 'proton.me',
               'protonmail.com', 'zoho.com', 'mail.com', 'gmx.com', 'yandex.com'
             ))
             and (
               v_email_domain = v_web_host
               or right(v_email_domain, length(v_web_host) + 1) = '.' || v_web_host
               or right(v_web_host, length(v_email_domain) + 1) = '.' || v_email_domain
             )
          then
            v_domain_proof := true;
          end if;
        end if;

        -- Activate organization
        update public.institutions
        set status = 'active',
            domain_proof = v_domain_proof,
            updated_at = now()
        where id = v_inst.id;

        insert into public.audit_log (
          institution_id, actor_id, action, entity_type, entity_id, metadata
        ) values (
          v_inst.id, NEW.id, 'organization.activated', 'institution', v_inst.id,
          jsonb_build_object('domain_proof', v_domain_proof)
        );
      end if;
    elsif v_prof.id is not null and v_prof.role = 'member' then
      perform public.apply_domain_verification(NEW.id);
    end if;
  end if;
  return NEW;
end;
$$;

-- =============================================================================
-- SECTION 5: UPDATED search_institutions & match_organization_by_email
-- =============================================================================

-- Recreate search_institutions returning domain_proof (status = 'active' only)
drop function if exists public.search_institutions(text);
create or replace function public.search_institutions(p_query text)
returns table (
  id           uuid,
  name         text,
  type         text,
  domain_proof boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q text;
begin
  v_q := trim(coalesce(p_query, ''));

  if length(v_q) < 3 then
    raise exception 'query_too_short';
  end if;

  return query
  select i.id, i.name, i.type, i.domain_proof
  from public.institutions i
  where i.status = 'active'
    and i.name ilike ('%' || v_q || '%')
  order by
    case when i.name ilike (v_q || '%') then 0 else 1 end,
    i.name asc
  limit 8;
end;
$$;

revoke execute on function public.search_institutions(text) from public;
grant execute on function public.search_institutions(text) to anon, authenticated;

-- Exclude pending organizations from match_organization_by_email
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
      and i.status = 'active'
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

-- Update set_member_institution to require active organization
create or replace function public.set_member_institution(p_institution_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_result  public.profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;
  if not found then
    raise exception 'not_found';
  end if;

  if v_profile.institution_id is not null then
    raise exception 'invalid_state';
  end if;

  if not exists (select 1 from public.institutions where id = p_institution_id and status = 'active') then
    raise exception 'invalid_institution';
  end if;

  update public.profiles
  set institution_id = p_institution_id,
      updated_at     = now()
  where id = v_uid
  returning * into v_result;

  return v_result;
end;
$$;

-- =============================================================================
-- SECTION 6: APPROVAL HARDENING & NEW admin_cancel_booking RPC
-- =============================================================================

-- 1. Hardened decide_booking
create or replace function public.decide_booking(
  p_booking_id uuid,
  p_approve    boolean,
  p_note       text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_result  public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.is_institution_admin(v_booking.institution_id) then raise exception 'forbidden'; end if;
  if v_booking.status <> 'pending' then raise exception 'invalid_state'; end if;

  if p_note is not null and length(trim(p_note)) > 500 then
    raise exception 'note_too_long';
  end if;

  -- Re-check overlap on approval
  if p_approve then
    if exists (
      select 1
      from   public.bookings
      where  resource_id = v_booking.resource_id
        and  id          <> v_booking.id
        and  status      in ('approved', 'checked_out')
        and  tstzrange(start_at, end_at, '[)') && tstzrange(v_booking.start_at, v_booking.end_at, '[)')
    ) then
      raise exception 'slot_taken';
    end if;
  end if;

  update public.bookings
  set status        = case when p_approve then 'approved'::public.booking_status else 'rejected'::public.booking_status end,
      decided_by    = v_uid,
      decided_at    = now(),
      decision_note = trim(p_note)
  where id = p_booking_id
  returning * into v_result;

  -- Audit log entry
  insert into public.audit_log (
    institution_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_booking.institution_id,
    v_uid,
    case when p_approve then 'booking.approved' else 'booking.rejected' end,
    'booking',
    p_booking_id,
    jsonb_build_object(
      'decision_note', trim(p_note),
      'approved', p_approve
    )
  );

  perform public.notify(
    v_result.user_id,
    case when p_approve then 'booking_approved' else 'booking_rejected' end,
    case when p_approve then 'Booking Approved' else 'Booking Declined' end,
    case when p_approve
         then coalesce('Your booking was approved: ' || trim(p_note), 'Your booking has been approved.')
         else coalesce('Your booking was declined: ' || trim(p_note), 'Your booking was declined.')
    end,
    '/app/bookings'
  );

  return v_result;
end;
$$;

-- 2. New RPC: admin_cancel_booking
create or replace function public.admin_cancel_booking(
  p_booking_id uuid,
  p_note       text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_result  public.bookings%rowtype;
  v_slot_id uuid;
  v_entry   record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;

  if not public.is_institution_admin(v_booking.institution_id) then
    raise exception 'forbidden';
  end if;

  if v_booking.status <> 'approved' or now() >= v_booking.start_at then
    raise exception 'invalid_state';
  end if;

  if p_note is not null and length(trim(p_note)) > 500 then
    raise exception 'note_too_long';
  end if;

  update public.bookings
  set status        = 'cancelled'::public.booking_status,
      decided_by    = v_uid,
      decided_at    = now(),
      decision_note = trim(p_note)
  where id = p_booking_id
  returning * into v_result;

  -- Offer slot to waitlist like release_booking
  insert into public.released_slots(
    booking_id, resource_id, institution_id, start_at, end_at, released_by, status
  ) values (
    p_booking_id, v_booking.resource_id, v_booking.institution_id,
    v_booking.start_at, v_booking.end_at, v_uid, 'open'
  )
  returning id into v_slot_id;

  for v_entry in
    select we.id, we.user_id
    from   public.waitlist_entries we
    where  we.resource_id = v_booking.resource_id
      and  we.status      = 'waiting'
      and  we.desired_start <= v_booking.end_at
      and  we.desired_end   >= v_booking.start_at
    order  by we.created_at
  loop
    update public.waitlist_entries set status = 'offered' where id = v_entry.id;
    perform public.notify(
      v_entry.user_id,
      'slot_available',
      'A slot is now available',
      'A cancelled booking slot matches your waitlist request.',
      '/app/discover'
    );
  end loop;

  -- Audit log entry
  insert into public.audit_log (
    institution_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_booking.institution_id,
    v_uid,
    'booking.admin_cancelled',
    'booking',
    p_booking_id,
    jsonb_build_object('cancellation_note', trim(p_note), 'previous_status', 'approved')
  );

  -- Notify borrower
  perform public.notify(
    v_result.user_id,
    'booking_cancelled',
    'Booking Cancelled by Administrator',
    coalesce('Your approved booking was cancelled by an administrator: ' || trim(p_note), 'Your approved booking was cancelled by an administrator.'),
    '/app/bookings'
  );

  return v_result;
end;
$$;

revoke execute on function public.admin_cancel_booking(uuid, text) from public, anon;
grant execute on function public.admin_cancel_booking(uuid, text) to authenticated;

-- =============================================================================
-- SECTION 7: PENDING LOCK ENFORCEMENT ON CHECKOUT & QR RESOLUTION
-- =============================================================================

-- 1. check_out_booking with distinct status codes
create or replace function public.check_out_booking(
  p_booking_id       uuid,
  p_photos           jsonb,
  p_condition        public.condition_rating,
  p_notes            text,
  p_accessory_checks jsonb,
  p_qr_identifier    text
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := (select auth.uid());
  v_booking        public.bookings%rowtype;
  v_resource       public.resources%rowtype;
  v_result         public.bookings%rowtype;
  v_photo          jsonb;
  v_required_slots text[];
  v_captured_slots text[];
  v_missing_slots  text[];
  v_path_prefix    text;
  v_hash_prefixes  text[] := '{}';
  v_clean_qr       text;
  v_acc_count      int;
  v_check_count    int;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_booking.user_id <> v_uid or v_booking.institution_id <> public.current_institution_id() then
    raise exception 'forbidden';
  end if;

  -- Strict status check with specific machine error codes
  if v_booking.status = 'pending' then
    raise exception 'booking_pending_approval';
  elsif v_booking.status = 'rejected' then
    raise exception 'booking_rejected';
  elsif v_booking.status = 'cancelled' then
    raise exception 'booking_cancelled';
  elsif v_booking.status <> 'approved' then
    raise exception 'invalid_state';
  end if;

  -- Allowed window check (allow 15m early up to end_at)
  if now() < (v_booking.start_at - interval '15 minutes') or now() > v_booking.end_at then
    raise exception 'outside_window';
  end if;

  select * into v_resource from public.resources where id = v_booking.resource_id;

  -- a) QR code requirement and verification
  v_clean_qr := trim(coalesce(p_qr_identifier, ''));
  if v_clean_qr = '' then
    raise exception 'qr_required';
  end if;
  if v_clean_qr <> v_resource.qr_identifier then
    raise exception 'qr_mismatch';
  end if;

  -- b) Complete accessory checklist verification
  select count(*) into v_acc_count
  from public.resource_accessories
  where resource_id = v_resource.id;

  select count(*) into v_check_count
  from jsonb_array_elements(coalesce(p_accessory_checks, '[]'::jsonb));

  if v_acc_count > 0 and v_check_count < v_acc_count then
    raise exception 'accessory_checklist_incomplete';
  end if;

  -- c) Required photo slots check
  v_required_slots := v_resource.required_photo_slots;
  select array_agg(elem ->> 'slot')
  into   v_captured_slots
  from   jsonb_array_elements(p_photos) elem;

  select coalesce(array_agg(s), '{}'::text[])
  into   v_missing_slots
  from   unnest(v_required_slots) s
  where  not (s = any(coalesce(v_captured_slots, '{}'::text[])));

  if array_length(v_missing_slots, 1) > 0 then
    raise exception 'missing_photos:%', array_to_string(v_missing_slots, ',');
  end if;

  -- d) Storage path validation and SHA-256 integrity check
  v_path_prefix := v_booking.institution_id::text || '/' || p_booking_id::text || '/checkout/';
  for v_photo in select * from jsonb_array_elements(p_photos) loop
    if not ((v_photo ->> 'storage_path') like (v_path_prefix || '%')) then
      raise exception 'invalid_photo_path:%', v_photo ->> 'storage_path';
    end if;

    if length(coalesce(v_photo ->> 'sha256', '')) <> 64 then
      raise exception 'invalid_hash:%', coalesce(v_photo ->> 'slot', 'unknown');
    end if;

    v_hash_prefixes := array_append(v_hash_prefixes, left(v_photo ->> 'sha256', 8));

    insert into public.custody_photos (
      booking_id, phase, slot, storage_path, taken_by, sha256, client_captured_at
    ) values (
      p_booking_id,
      'checkout',
      v_photo ->> 'slot',
      v_photo ->> 'storage_path',
      v_uid,
      v_photo ->> 'sha256',
      coalesce((v_photo ->> 'client_captured_at')::timestamptz, now())
    )
    on conflict (booking_id, phase, slot) do nothing;
  end loop;

  -- Record custody event
  insert into public.custody_events (
    booking_id, phase, actor_id, condition, notes, accessory_checks
  ) values (
    p_booking_id, 'checkout', v_uid, p_condition, p_notes,
    coalesce(p_accessory_checks, '[]'::jsonb)
  );

  update public.bookings
  set status = 'checked_out'
  where id = p_booking_id
  returning * into v_result;

  perform public.log_custody_event(
    p_booking_id,
    'custody.checkout_completed',
    jsonb_build_object(
      'condition', p_condition,
      'hash_prefixes', v_hash_prefixes,
      'notes_required', false
    )
  );

  return v_result;
end;
$$;

-- 2. verify_asset_qr with specific machine error codes
create or replace function public.verify_asset_qr(
  p_booking_id uuid,
  p_qr         text,
  p_phase      text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_booking  public.bookings%rowtype;
  v_resource public.resources%rowtype;
  v_clean_qr text;
  v_is_match boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;

  -- Borrower only
  if v_booking.user_id <> v_uid then raise exception 'forbidden'; end if;

  -- Tenant check
  if v_booking.institution_id <> public.current_institution_id() then
    raise exception 'forbidden';
  end if;

  -- Validate state per phase
  if p_phase = 'checkout' then
    if v_booking.status = 'pending' then
      raise exception 'booking_pending_approval';
    elsif v_booking.status = 'rejected' then
      raise exception 'booking_rejected';
    elsif v_booking.status = 'cancelled' then
      raise exception 'booking_cancelled';
    elsif v_booking.status <> 'approved' then
      raise exception 'invalid_state';
    end if;

    if now() < (v_booking.start_at - interval '15 minutes') or now() > v_booking.end_at then
      raise exception 'outside_window';
    end if;
  elsif p_phase = 'return' then
    if v_booking.status <> 'checked_out' then raise exception 'invalid_state'; end if;
  else
    raise exception 'invalid_state';
  end if;

  select * into v_resource from public.resources where id = v_booking.resource_id;
  v_clean_qr := trim(coalesce(p_qr, ''));
  v_is_match := (v_clean_qr = v_resource.qr_identifier);

  if v_is_match then
    perform public.log_custody_event(
      p_booking_id,
      'custody.qr_verified',
      jsonb_build_object('phase', p_phase, 'qr', v_clean_qr)
    );
  else
    perform public.log_custody_event(
      p_booking_id,
      'custody.qr_mismatch',
      jsonb_build_object('phase', p_phase, 'scanned_qr', v_clean_qr)
    );
  end if;

  return v_is_match;
end;
$$;

-- 3. start_checkout with specific machine error codes
create or replace function public.start_checkout(p_booking_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;

  if v_booking.user_id <> v_uid or v_booking.institution_id <> public.current_institution_id() then
    raise exception 'forbidden';
  end if;

  if v_booking.status = 'pending' then
    raise exception 'booking_pending_approval';
  elsif v_booking.status = 'rejected' then
    raise exception 'booking_rejected';
  elsif v_booking.status = 'cancelled' then
    raise exception 'booking_cancelled';
  elsif v_booking.status <> 'approved' then
    raise exception 'invalid_state';
  end if;

  if now() < (v_booking.start_at - interval '15 minutes') or now() > v_booking.end_at then
    raise exception 'outside_window';
  end if;

  perform public.log_custody_event(
    p_booking_id,
    'custody.checkout_started',
    jsonb_build_object('start_at', v_booking.start_at)
  );
end;
$$;

-- 4. resolve_asset_qr returning blocked array for unapproved bookings
create or replace function public.resolve_asset_qr(p_qr text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id   uuid;
  v_inst_id     uuid;
  v_resource    public.resources%rowtype;
  v_actions     jsonb := '[]'::jsonb;
  v_blocked     jsonb := '[]'::jsonb;
  v_can_audit   boolean := false;
  v_now         timestamptz := now();
  v_booking     record;
  v_b           record;
  v_clean_qr    text;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  v_inst_id := public.current_institution_id();
  if v_inst_id is null then
    raise exception 'forbidden';
  end if;

  v_clean_qr := trim(coalesce(p_qr, ''));
  if v_clean_qr = '' then
    raise exception 'not_found';
  end if;

  select * into v_resource
  from public.resources
  where institution_id = v_inst_id
    and (
      qr_identifier = v_clean_qr
      or lower(trim(asset_tag)) = lower(v_clean_qr)
    );

  if not found then
    raise exception 'not_found';
  end if;

  v_can_audit := public.is_institution_admin(v_inst_id);

  -- Evaluate caller actions on this asset
  -- 1. Checkout action: approved booking inside handover window (allow 15m early)
  select id into v_booking
  from public.bookings
  where resource_id = v_resource.id
    and user_id = v_caller_id
    and status = 'approved'
    and v_now >= (start_at - interval '15 minutes')
    and v_now <= end_at
  order by start_at asc
  limit 1;

  if v_booking.id is not null then
    v_actions := v_actions || jsonb_build_object('type', 'checkout', 'booking_id', v_booking.id);
  end if;

  -- 2. Return action: checked_out booking owned by caller
  select id into v_booking
  from public.bookings
  where resource_id = v_resource.id
    and user_id = v_caller_id
    and status = 'checked_out'
  order by start_at asc
  limit 1;

  if v_booking.id is not null then
    v_actions := v_actions || jsonb_build_object('type', 'return', 'booking_id', v_booking.id);
  end if;

  -- 3. Find blocked bookings (pending, rejected, cancelled) to prevent offering actions
  for v_b in
    select id, status
    from public.bookings
    where resource_id = v_resource.id
      and user_id = v_caller_id
      and status in ('pending', 'rejected', 'cancelled')
    order by start_at asc
  loop
    v_blocked := v_blocked || jsonb_build_object(
      'booking_id', v_b.id,
      'reason', case
        when v_b.status = 'pending' then 'booking_pending_approval'
        when v_b.status = 'rejected' then 'booking_rejected'
        when v_b.status = 'cancelled' then 'booking_cancelled'
        else 'invalid_state'
      end
    );
  end loop;

  return jsonb_build_object(
    'resource_id', v_resource.id,
    'name',        v_resource.name,
    'asset_tag',   v_resource.asset_tag,
    'status',      v_resource.status,
    'actions',     v_actions,
    'blocked',     v_blocked,
    'can_audit',   v_can_audit
  );
end;
$$;

-- =============================================================================
-- SECTION 8: TENANT ISOLATION POLICIES (Air-tight current_institution_id())
-- =============================================================================

-- 1. INSTITUTIONS
drop policy if exists "institutions_select_authenticated" on public.institutions;
create policy "institutions_select_authenticated"
  on public.institutions for select
  to authenticated
  using (
    id = public.current_institution_id()
    or public.is_institution_admin(id)
  );

drop policy if exists "institutions_update_admin" on public.institutions;
create policy "institutions_update_admin"
  on public.institutions for update
  to authenticated
  using (
    id = public.current_institution_id()
    and public.is_institution_admin(id)
  )
  with check (
    id = public.current_institution_id()
    and public.is_institution_admin(id)
  );

-- 2. PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (
    id = (select auth.uid())
    and (institution_id = public.current_institution_id() or institution_id is null)
  );

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (
    id = (select auth.uid())
    and (institution_id = public.current_institution_id() or institution_id is null)
  )
  with check (
    id = (select auth.uid())
    and (institution_id = public.current_institution_id() or institution_id is null)
  );

-- 3. RESOURCES
drop policy if exists "resources_select_authenticated" on public.resources;
create policy "resources_select_authenticated"
  on public.resources for select
  to authenticated
  using (institution_id = public.current_institution_id());

drop policy if exists "resources_insert_admin" on public.resources;
create policy "resources_insert_admin"
  on public.resources for insert
  to authenticated
  with check (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

drop policy if exists "resources_update_admin" on public.resources;
create policy "resources_update_admin"
  on public.resources for update
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  )
  with check (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

drop policy if exists "resources_delete_admin" on public.resources;
create policy "resources_delete_admin"
  on public.resources for delete
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

-- 4. BOOKINGS
drop policy if exists "bookings_select_own" on public.bookings;
create policy "bookings_select_own"
  on public.bookings for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and institution_id = public.current_institution_id()
  );

drop policy if exists "bookings_select_admin" on public.bookings;
create policy "bookings_select_admin"
  on public.bookings for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

-- 5. WAITLIST_ENTRIES
drop policy if exists "waitlist_entries_select_own" on public.waitlist_entries;
create policy "waitlist_entries_select_own"
  on public.waitlist_entries for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.resources r
      where r.id = resource_id and r.institution_id = public.current_institution_id()
    )
  );

drop policy if exists "waitlist_entries_select_admin" on public.waitlist_entries;
create policy "waitlist_entries_select_admin"
  on public.waitlist_entries for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

-- 6. RELEASED_SLOTS
drop policy if exists "released_slots_select_own" on public.released_slots;
create policy "released_slots_select_own"
  on public.released_slots for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and (released_by = (select auth.uid()) or claimed_by = (select auth.uid()))
  );

drop policy if exists "released_slots_select_admin" on public.released_slots;
create policy "released_slots_select_admin"
  on public.released_slots for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

drop policy if exists "released_slots_select_open_member" on public.released_slots;
create policy "released_slots_select_open_member"
  on public.released_slots for select
  to authenticated
  using (
    status = 'open'
    and public.is_verified_member()
    and institution_id = public.current_institution_id()
  );

-- 7. CUSTODY_EVENTS
drop policy if exists "custody_events_select_participant" on public.custody_events;
create policy "custody_events_select_participant"
  on public.custody_events for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.institution_id = public.current_institution_id()
        and (b.user_id = (select auth.uid()) or public.is_institution_admin(b.institution_id))
    )
  );

-- 8. CUSTODY_PHOTOS
drop policy if exists "custody_photos_select_participant" on public.custody_photos;
create policy "custody_photos_select_participant"
  on public.custody_photos for select
  to authenticated
  using (
    exists (
      select 1 from public.bookings b
      where b.id = booking_id
        and b.institution_id = public.current_institution_id()
        and (b.user_id = (select auth.uid()) or public.is_institution_admin(b.institution_id))
    )
  );

-- 9. INCIDENTS
drop policy if exists "incidents_select_participant" on public.incidents;
create policy "incidents_select_participant"
  on public.incidents for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and (reported_by = (select auth.uid()) or exists (
      select 1 from public.bookings b where b.id = booking_id and b.user_id = (select auth.uid())
    ))
  );

drop policy if exists "incidents_select_admin" on public.incidents;
create policy "incidents_select_admin"
  on public.incidents for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

-- 10. NOTIFICATIONS
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = user_id
        and (p.institution_id = public.current_institution_id() or p.institution_id is null)
    )
  );

drop policy if exists "notifications_update_read_at" on public.notifications;
create policy "notifications_update_read_at"
  on public.notifications for update
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = user_id
        and (p.institution_id = public.current_institution_id() or p.institution_id is null)
    )
  )
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = user_id
        and (p.institution_id = public.current_institution_id() or p.institution_id is null)
    )
  );

-- 11. AUDIT_LOG
drop policy if exists "audit_log_select_admin" on public.audit_log;
create policy "audit_log_select_admin"
  on public.audit_log for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

-- 12. ASSET_AUDITS
drop policy if exists "asset_audits_select_admin" on public.asset_audits;
create policy "asset_audits_select_admin"
  on public.asset_audits for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

-- 13. QUALIFICATIONS
drop policy if exists "qualifications_select_authenticated" on public.qualifications;
create policy "qualifications_select_authenticated"
  on public.qualifications for select
  to authenticated
  using (institution_id = public.current_institution_id());

drop policy if exists "qualifications_insert_admin" on public.qualifications;
create policy "qualifications_insert_admin"
  on public.qualifications for insert
  to authenticated
  with check (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

drop policy if exists "qualifications_update_admin" on public.qualifications;
create policy "qualifications_update_admin"
  on public.qualifications for update
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  )
  with check (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

drop policy if exists "qualifications_delete_admin" on public.qualifications;
create policy "qualifications_delete_admin"
  on public.qualifications for delete
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

-- 14. USER_QUALIFICATIONS
drop policy if exists "user_qualifications_select_own" on public.user_qualifications;
create policy "user_qualifications_select_own"
  on public.user_qualifications for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.qualifications q
      where q.id = qualification_id and q.institution_id = public.current_institution_id()
    )
  );

drop policy if exists "user_qualifications_select_admin" on public.user_qualifications;
create policy "user_qualifications_select_admin"
  on public.user_qualifications for select
  to authenticated
  using (
    exists (
      select 1 from public.qualifications q
      where q.id = qualification_id
        and q.institution_id = public.current_institution_id()
        and public.is_institution_admin(q.institution_id)
    )
  );

drop policy if exists "user_qualifications_insert_own" on public.user_qualifications;
create policy "user_qualifications_insert_own"
  on public.user_qualifications for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.qualifications q
      where q.id = qualification_id and q.institution_id = public.current_institution_id()
    )
  );

-- 15. RESOURCE_CATEGORIES
drop policy if exists "resource_categories_select" on public.resource_categories;
create policy "resource_categories_select"
  on public.resource_categories for select
  to authenticated
  using (institution_id = public.current_institution_id());

drop policy if exists "resource_categories_insert_admin" on public.resource_categories;
create policy "resource_categories_insert_admin"
  on public.resource_categories for insert
  to authenticated
  with check (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

drop policy if exists "resource_categories_delete_admin" on public.resource_categories;
create policy "resource_categories_delete_admin"
  on public.resource_categories for delete
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and public.is_institution_admin(institution_id)
  );

-- 16. ELIGIBILITY_RULES, ACCESSORIES, WINDOWS, EVIDENCE
drop policy if exists "eligibility_rules_select_authenticated" on public.eligibility_rules;
create policy "eligibility_rules_select_authenticated"
  on public.eligibility_rules for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and r.institution_id = public.current_institution_id()
    )
  );

drop policy if exists "eligibility_rules_insert_admin" on public.eligibility_rules;
create policy "eligibility_rules_insert_admin"
  on public.eligibility_rules for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "eligibility_rules_update_admin" on public.eligibility_rules;
create policy "eligibility_rules_update_admin"
  on public.eligibility_rules for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "eligibility_rules_delete_admin" on public.eligibility_rules;
create policy "eligibility_rules_delete_admin"
  on public.eligibility_rules for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "resource_accessories_select_authenticated" on public.resource_accessories;
create policy "resource_accessories_select_authenticated"
  on public.resource_accessories for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and r.institution_id = public.current_institution_id()
    )
  );

drop policy if exists "resource_accessories_insert_admin" on public.resource_accessories;
create policy "resource_accessories_insert_admin"
  on public.resource_accessories for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "resource_accessories_update_admin" on public.resource_accessories;
create policy "resource_accessories_update_admin"
  on public.resource_accessories for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "resource_accessories_delete_admin" on public.resource_accessories;
create policy "resource_accessories_delete_admin"
  on public.resource_accessories for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "raw_select_authenticated" on public.resource_availability_windows;
create policy "raw_select_authenticated"
  on public.resource_availability_windows for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and r.institution_id = public.current_institution_id()
    )
  );

drop policy if exists "raw_insert_admin" on public.resource_availability_windows;
create policy "raw_insert_admin"
  on public.resource_availability_windows for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "raw_update_admin" on public.resource_availability_windows;
create policy "raw_update_admin"
  on public.resource_availability_windows for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "raw_delete_admin" on public.resource_availability_windows;
create policy "raw_delete_admin"
  on public.resource_availability_windows for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "resource_evidence_select_admin" on public.resource_evidence;
create policy "resource_evidence_select_admin"
  on public.resource_evidence for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "resource_evidence_insert_admin" on public.resource_evidence;
create policy "resource_evidence_insert_admin"
  on public.resource_evidence for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "resource_evidence_update_admin" on public.resource_evidence;
create policy "resource_evidence_update_admin"
  on public.resource_evidence for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

drop policy if exists "resource_evidence_delete_admin" on public.resource_evidence;
create policy "resource_evidence_delete_admin"
  on public.resource_evidence for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
        and public.is_institution_admin(r.institution_id)
    )
  );

-- 17. STORAGE OBJECTS POLICIES
drop policy if exists "resource_images_tenant_select" on storage.objects;
create policy "resource_images_tenant_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resource-images'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
  );

drop policy if exists "resource_images_tenant_insert_admin" on storage.objects;
create policy "resource_images_tenant_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resource-images'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.is_institution_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "resource_images_tenant_update_admin" on storage.objects;
create policy "resource_images_tenant_update_admin"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resource-images'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.is_institution_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "resource_images_tenant_delete_admin" on storage.objects;
create policy "resource_images_tenant_delete_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resource-images'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.is_institution_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "custody_photos_insert_owner" on storage.objects;
create policy "custody_photos_insert_owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'custody-photos'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and exists (
      select 1 from public.bookings b
      where b.id::text = (storage.foldername(name))[2]
        and b.user_id = (select auth.uid())
        and b.status in ('approved', 'checked_out')
        and b.institution_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists "custody_photos_select_participant" on storage.objects;
create policy "custody_photos_select_participant"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'custody-photos'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and (
      exists (
        select 1 from public.bookings b
        where b.id::text = (storage.foldername(name))[2]
          and b.institution_id = public.current_institution_id()
          and (b.user_id = (select auth.uid()) or public.is_institution_admin(b.institution_id))
      )
      or public.can_read_prior_return_photo(name)
    )
  );

drop policy if exists "asset_audit_photos_insert_admin" on storage.objects;
create policy "asset_audit_photos_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'asset-audit-photos'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.is_institution_admin((storage.foldername(name))[1]::uuid)
  );

drop policy if exists "asset_audit_photos_select_admin" on storage.objects;
create policy "asset_audit_photos_select_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'asset-audit-photos'
    and (storage.foldername(name))[1] = public.current_institution_id()::text
    and public.is_institution_admin((storage.foldername(name))[1]::uuid)
  );

-- =============================================================================
-- SECTION 9: REFRESH NOTIFICATION & GRANTS
-- =============================================================================

notify pgrst, 'reload schema';
