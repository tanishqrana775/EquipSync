-- =============================================================================
-- 0004_fixes.sql  –  CampusShare  –  Trigger fixes, Context RPC, Indexes
-- Depends on: 0001_schema.sql, 0002_functions.sql, 0003_rls_storage.sql
-- =============================================================================

-- ===========================================================================
-- SECTION 1: FIX handle_new_user TRIGGER
-- Ensure EVERY auth.users row gets a profile. Never throw on missing role/inst.
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
  -- Parse raw_user_meta_data
  v_role           := new.raw_user_meta_data ->> 'role';
  v_full_name      := coalesce(
    new.raw_user_meta_data ->> 'full_name',
    split_part(coalesce(new.email, 'User'), '@', 1)
  );
  v_user_type      := new.raw_user_meta_data ->> 'user_type';
  v_inst_name      := new.raw_user_meta_data ->> 'institution_name';
  v_inst_type      := new.raw_user_meta_data ->> 'institution_type';
  v_email_domain   := new.raw_user_meta_data ->> 'email_domain';

  -- Safely parse institution_id if provided
  begin
    if (new.raw_user_meta_data ->> 'institution_id') is not null then
      v_institution_id := (new.raw_user_meta_data ->> 'institution_id')::uuid;
      -- Verify institution exists
      select id into v_valid_inst_id
      from public.institutions
      where id = v_institution_id;
    end if;
  exception when others then
    v_valid_inst_id := null;
  end;

  if v_role = 'institution_admin' and v_inst_name is not null and trim(v_inst_name) <> '' then
    -- Create the institution first
    insert into public.institutions(name, type, email_domain, created_by)
    values (
      v_inst_name,
      coalesce(v_inst_type, 'university'),
      v_email_domain,
      new.id
    )
    returning id into v_new_inst_id;

    -- Create institution_admin profile (auto-verified)
    insert into public.profiles(
      id, institution_id, full_name, role, user_type, verification_status
    ) values (
      new.id,
      v_new_inst_id,
      v_full_name,
      'institution_admin',
      coalesce(v_user_type::public.user_type, 'staff'),
      'verified'
    )
    on conflict (id) do update set
      institution_id      = excluded.institution_id,
      full_name           = excluded.full_name,
      role                = excluded.role,
      user_type           = excluded.user_type,
      verification_status = excluded.verification_status;

  else
    -- Default to member profile; institution_id may be null if missing or invalid
    insert into public.profiles(
      id, institution_id, full_name, role, user_type, verification_status
    ) values (
      new.id,
      v_valid_inst_id,
      v_full_name,
      'member',
      case
        when v_user_type in ('student', 'staff', 'external') then v_user_type::public.user_type
        else 'student'::public.user_type
      end,
      'pending'
    )
    on conflict (id) do nothing;
  end if;

  return new;
exception when others then
  -- Fail-safe fallback: ensure a profile always exists, never block auth user creation
  insert into public.profiles(
    id, institution_id, full_name, role, user_type, verification_status
  ) values (
    new.id,
    null,
    coalesce(split_part(coalesce(new.email, 'User'), '@', 1), 'Member'),
    'member',
    'student',
    'pending'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Ensure trigger is active on auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- SECTION 2: IDEMPOTENT BACKFILL
-- Insert a profile for any existing auth.users row that has none
-- ===========================================================================

insert into public.profiles (id, full_name, role, user_type, verification_status)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', split_part(coalesce(u.email, 'User'), '@', 1)),
  'member'::public.user_role,
  coalesce((u.raw_user_meta_data ->> 'user_type')::public.user_type, 'student'::public.user_type),
  'pending'::public.verification_status
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;

-- ===========================================================================
-- SECTION 3: RPC get_my_context()
-- Returns caller's profile + institution name + verified qualification ids
-- ===========================================================================

create or replace function public.get_my_context()
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_profile   public.profiles%rowtype;
  v_inst_name text := null;
  v_inst      public.institutions%rowtype;
  v_quals     jsonb := '[]'::jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then
    raise exception 'not_found';
  end if;

  if v_profile.institution_id is not null then
    select * into v_inst from public.institutions where id = v_profile.institution_id;
    v_inst_name := v_inst.name;
  end if;

  select coalesce(jsonb_agg(qualification_id), '[]'::jsonb)
  into   v_quals
  from   public.user_qualifications
  where  user_id = v_uid
    and  status  = 'verified';

  return jsonb_build_object(
    'profile',                     to_jsonb(v_profile),
    'institution_id',             v_profile.institution_id,
    'institution_name',           v_inst_name,
    'institution',                 case when v_inst.id is not null then to_jsonb(v_inst) else null end,
    'verified_qualification_ids', v_quals
  );
end;
$$;

revoke execute on function public.get_my_context() from public, anon;
grant execute on function public.get_my_context() to authenticated;

-- ===========================================================================
-- SECTION 4: RPC set_member_institution(p_institution_id)
-- Usable only when caller's institution_id is null
-- ===========================================================================

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

  if not exists (select 1 from public.institutions where id = p_institution_id) then
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

revoke execute on function public.set_member_institution(uuid) from public, anon;
grant execute on function public.set_member_institution(uuid) to authenticated;

-- ===========================================================================
-- SECTION 5: PERFORMANCE INDEXES
-- ===========================================================================

create index if not exists idx_audit_log_inst_created
  on public.audit_log(institution_id, created_at desc);

create index if not exists idx_bookings_inst_status_start
  on public.bookings(institution_id, status, start_at);

-- ===========================================================================
-- SECTION 6: HELPER EXECUTE GRANTS FOR RLS EVALUATION
-- ===========================================================================

grant execute on function public.is_institution_admin(uuid) to anon, authenticated;
grant execute on function public.is_verified_member() to anon, authenticated;
grant execute on function public.is_booking_participant(uuid) to anon, authenticated;
grant execute on function public.current_institution_id() to anon, authenticated;
