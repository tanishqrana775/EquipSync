-- =============================================================================
-- 0005_multitenant.sql  –  EquipSync  –  Multi-Tenant Isolation
-- Strict tenant isolation for queries, storage, RPCs, and public metrics.
-- Idempotent: DROP POLICY IF EXISTS before CREATE, CREATE OR REPLACE for functions.
-- =============================================================================

-- ===========================================================================
-- SECTION 1: PUBLIC METRICS RPC (anon & authenticated)
-- ===========================================================================

create or replace function public.get_public_stats()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'institutions', (select count(*)::int from public.institutions),
    'resources',    (select count(*)::int from public.resources where status = 'active')
  );
$$;

revoke execute on function public.get_public_stats() from public;
grant execute on function public.get_public_stats() to anon, authenticated;

-- ===========================================================================
-- SECTION 2: TENANT-SCOPED SELECT POLICIES
-- ===========================================================================

-- 1. institutions (own only)
drop policy if exists "institutions_select_authenticated" on public.institutions;
create policy "institutions_select_authenticated"
  on public.institutions for select
  to authenticated
  using (id = public.current_institution_id());

-- 2. qualifications (own institution only)
drop policy if exists "qualifications_select_authenticated" on public.qualifications;
create policy "qualifications_select_authenticated"
  on public.qualifications for select
  to authenticated
  using (institution_id = public.current_institution_id());

-- 3. resources (own institution only)
drop policy if exists "resources_select_authenticated" on public.resources;
create policy "resources_select_authenticated"
  on public.resources for select
  to authenticated
  using (institution_id = public.current_institution_id());

-- 4. eligibility_rules (own institution only)
drop policy if exists "eligibility_rules_select_authenticated" on public.eligibility_rules;
create policy "eligibility_rules_select_authenticated"
  on public.eligibility_rules for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
    )
  );

-- 5. resource_required_qualifications (own institution only)
drop policy if exists "rrq_select_authenticated" on public.resource_required_qualifications;
create policy "rrq_select_authenticated"
  on public.resource_required_qualifications for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
    )
  );

-- 6. resource_accessories (own institution only)
drop policy if exists "resource_accessories_select_authenticated" on public.resource_accessories;
create policy "resource_accessories_select_authenticated"
  on public.resource_accessories for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
    )
  );

-- 7. resource_availability_windows (own institution only)
drop policy if exists "raw_select_authenticated" on public.resource_availability_windows;
create policy "raw_select_authenticated"
  on public.resource_availability_windows for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id
        and r.institution_id = public.current_institution_id()
    )
  );

-- 8. released_slots (own institution only)
drop policy if exists "released_slots_select_own" on public.released_slots;
create policy "released_slots_select_own"
  on public.released_slots for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    and (
      released_by = (select auth.uid())
      or claimed_by = (select auth.uid())
    )
  );

drop policy if exists "released_slots_select_admin" on public.released_slots;
create policy "released_slots_select_admin"
  on public.released_slots for select
  to authenticated
  using (public.is_institution_admin(institution_id));

drop policy if exists "released_slots_select_open_member" on public.released_slots;
create policy "released_slots_select_open_member"
  on public.released_slots for select
  to authenticated
  using (
    status = 'open'
    and public.is_verified_member()
    and institution_id = public.current_institution_id()
  );

-- ===========================================================================
-- SECTION 3: STORAGE TENANT LIST/SELECT SCOPING
-- ===========================================================================

drop policy if exists "resource_images_public_select" on storage.objects;
drop policy if exists "resource_images_tenant_select" on storage.objects;
create policy "resource_images_tenant_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resource-images'
    and (string_to_array(name, '/'))[1]::uuid = public.current_institution_id()
  );

-- ===========================================================================
-- SECTION 4: TENANT CHECKS IN RPCS
-- ===========================================================================

-- 1. request_booking: enforce caller belongs to resource's institution
create or replace function public.request_booking(
  p_resource_id     uuid,
  p_start           timestamptz,
  p_end             timestamptz,
  p_purpose         text,
  p_supervisor_name text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid            uuid := (select auth.uid());
  v_profile        public.profiles%rowtype;
  v_resource       public.resources%rowtype;
  v_rules          public.eligibility_rules%rowtype;
  v_duration_min   int;
  v_lead_min       int;
  v_missing_quals  text[];
  v_new_booking    public.bookings%rowtype;
  v_initial_status public.booking_status;
  v_admin          record;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  -- Load caller profile
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.verification_status <> 'verified' then
    raise exception 'not_verified';
  end if;

  -- Load resource
  select * into v_resource from public.resources where id = p_resource_id;
  if not found or v_resource.status <> 'active' or not v_resource.is_available then
    raise exception 'resource_unavailable';
  end if;

  -- Multi-tenant isolation: caller must belong to resource's institution
  if v_profile.institution_id is null or v_resource.institution_id <> v_profile.institution_id then
    raise exception 'forbidden';
  end if;

  -- Load eligibility rules
  select * into v_rules from public.eligibility_rules where resource_id = p_resource_id;

  -- Check user_type allowed
  if v_rules.allowed_user_types is not null
     and array_length(v_rules.allowed_user_types, 1) > 0
     and not (v_profile.user_type = any(v_rules.allowed_user_types)) then
    raise exception 'not_eligible:user_type_not_allowed';
  end if;

  -- Check duration
  v_duration_min := extract(epoch from (p_end - p_start)) / 60;
  if v_rules.max_duration_minutes is not null
     and v_duration_min > v_rules.max_duration_minutes then
    raise exception 'not_eligible:exceeds_max_duration';
  end if;

  -- Check lead time
  v_lead_min := extract(epoch from (p_start - now())) / 60;
  if v_lead_min < v_rules.min_lead_time_minutes then
    raise exception 'not_eligible:insufficient_lead_time';
  end if;

  -- Check supervision
  if v_rules.requires_supervision and (p_supervisor_name is null or trim(p_supervisor_name) = '') then
    raise exception 'not_eligible:supervisor_required';
  end if;

  -- Check required qualifications
  select array_agg(q.name order by q.name)
  into   v_missing_quals
  from   public.resource_required_qualifications rrq
  join   public.qualifications q on q.id = rrq.qualification_id
  where  rrq.resource_id = p_resource_id
    and  not exists (
      select 1
      from   public.user_qualifications uq
      where  uq.user_id          = v_uid
        and  uq.qualification_id = rrq.qualification_id
        and  uq.status           = 'verified'
    );

  if v_missing_quals is not null and array_length(v_missing_quals, 1) > 0 then
    raise exception 'not_eligible:missing_qualifications:%', array_to_string(v_missing_quals, ',');
  end if;

  -- Check for overlapping approved/checked_out bookings
  if exists (
    select 1
    from   public.bookings
    where  resource_id = p_resource_id
      and  status      in ('approved', 'checked_out')
      and  tstzrange(start_at, end_at, '[)') && tstzrange(p_start, p_end, '[)')
  ) then
    raise exception 'slot_taken';
  end if;

  -- Determine initial status
  if v_rules.requires_approval then
    v_initial_status := 'pending';
  else
    v_initial_status := 'approved';
  end if;

  -- Insert booking
  insert into public.bookings(
    resource_id, user_id, institution_id, start_at, end_at,
    purpose, supervisor_name, status
  ) values (
    p_resource_id, v_uid, v_resource.institution_id, p_start, p_end,
    p_purpose, p_supervisor_name, v_initial_status
  )
  returning * into v_new_booking;

  -- Notify institution admins
  for v_admin in
    select id from public.profiles
    where institution_id = v_resource.institution_id
      and role = 'institution_admin'
  loop
    perform public.notify(
      v_admin.id,
      'booking_request',
      'New booking request',
      'A new booking has been requested for ' || v_resource.name,
      '/app/bookings/' || v_new_booking.id
    );
  end loop;

  return v_new_booking;
end;
$$;

-- 2. join_waitlist: enforce caller belongs to resource's institution
create or replace function public.join_waitlist(
  p_resource_id uuid,
  p_start       timestamptz,
  p_end         timestamptz
)
returns public.waitlist_entries
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_profile    public.profiles%rowtype;
  v_resource   public.resources%rowtype;
  v_entry      public.waitlist_entries%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_verified_member() then raise exception 'not_verified'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  select * into v_resource from public.resources where id = p_resource_id;
  if not found then raise exception 'not_found'; end if;

  if v_profile.institution_id is null or v_resource.institution_id <> v_profile.institution_id then
    raise exception 'forbidden';
  end if;

  insert into public.waitlist_entries(resource_id, user_id, desired_start, desired_end, status)
  values (p_resource_id, v_uid, p_start, p_end, 'waiting')
  returning * into v_entry;

  return v_entry;
end;
$$;

-- 3. claim_released_slot: enforce caller belongs to slot's institution
create or replace function public.claim_released_slot(p_slot_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_profile public.profiles%rowtype;
  v_slot    public.released_slots%rowtype;
  v_new_bk  public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_verified_member() then raise exception 'not_verified'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  select * into v_slot from public.released_slots where id = p_slot_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_slot.status <> 'open' then raise exception 'invalid_state'; end if;

  if v_profile.institution_id is null or v_slot.institution_id <> v_profile.institution_id then
    raise exception 'forbidden';
  end if;

  -- Validate eligibility & insert booking
  select * into v_new_bk
  from public.request_booking(
    v_slot.resource_id, v_slot.start_at, v_slot.end_at, 'Claimed from released slot', null
  );

  update public.released_slots
  set status             = 'claimed',
      claimed_by         = v_uid,
      claimed_booking_id = v_new_bk.id
  where id = p_slot_id;

  update public.waitlist_entries
  set status = 'cancelled'
  where resource_id   = v_slot.resource_id
    and status        = 'offered'
    and desired_start <= v_slot.end_at
    and desired_end   >= v_slot.start_at
    and user_id       <> v_uid;

  return v_new_bk;
end;
$$;

-- 4. check_in_booking: require notes on damaged or missing_parts condition
create or replace function public.check_in_booking(
  p_booking_id       uuid,
  p_photos           jsonb,
  p_condition        public.condition_rating,
  p_notes            text,
  p_accessory_checks jsonb default '[]'::jsonb
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
  v_incident_id    uuid;
  v_admin          record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_booking.user_id <> v_uid then raise exception 'forbidden'; end if;
  if v_booking.status <> 'checked_out' then raise exception 'invalid_state'; end if;

  -- Validate return notes requirement
  if p_condition in ('damaged', 'missing_parts') and (p_notes is null or trim(p_notes) = '') then
    raise exception 'notes_required';
  end if;

  -- Load resource
  select * into v_resource from public.resources where id = v_booking.resource_id;
  v_required_slots := v_resource.required_photo_slots;

  -- Collect provided slots
  select array_agg(ph ->> 'slot')
  into   v_captured_slots
  from   jsonb_array_elements(p_photos) ph;

  -- Find missing slots
  select array_agg(s)
  into   v_missing_slots
  from   unnest(v_required_slots) s
  where  not (s = any(coalesce(v_captured_slots, '{}'::text[])));

  if v_missing_slots is not null and array_length(v_missing_slots, 1) > 0 then
    raise exception 'missing_photos:%', array_to_string(v_missing_slots, ',');
  end if;

  v_path_prefix := v_booking.institution_id::text || '/' || p_booking_id::text || '/checkin/';

  -- Insert photos
  for v_photo in select * from jsonb_array_elements(p_photos)
  loop
    if not ((v_photo ->> 'storage_path') like (v_path_prefix || '%')) then
      raise exception 'forbidden';
    end if;

    insert into public.custody_photos(
      booking_id, phase, slot, storage_path, taken_by, sha256, client_captured_at
    ) values (
      p_booking_id,
      'checkin',
      v_photo ->> 'slot',
      v_photo ->> 'storage_path',
      v_uid,
      v_photo ->> 'sha256',
      (v_photo ->> 'client_captured_at')::timestamptz
    )
    on conflict (booking_id, phase, slot) do nothing;
  end loop;

  -- Insert custody_event
  insert into public.custody_events(booking_id, phase, actor_id, condition, notes, accessory_checks)
  values (p_booking_id, 'checkin', v_uid, p_condition, p_notes, coalesce(p_accessory_checks, '[]'::jsonb));

  -- Update status to returned
  update public.bookings set status = 'returned' where id = p_booking_id returning * into v_result;

  -- Auto-create incident on condition defects & notify admins
  if p_condition in ('damaged', 'missing_parts') then
    insert into public.incidents(
      booking_id, resource_id, institution_id, reported_by,
      severity, type, description, status
    ) values (
      p_booking_id, v_booking.resource_id, v_booking.institution_id, v_uid,
      'medium',
      case when p_condition = 'damaged' then 'damage' else 'missing_accessory' end,
      coalesce(p_notes, 'Condition issue reported during return check-in.'),
      'open'
    )
    returning id into v_incident_id;

    for v_admin in
      select id from public.profiles
      where institution_id = v_booking.institution_id and role = 'institution_admin'
    loop
      perform public.notify(
        v_admin.id,
        'incident_reported',
        'Incident reported on return',
        'A condition issue was noted during check-in for resource: ' || v_resource.name,
        '/app/bookings/' || p_booking_id
      );
    end loop;
  end if;

  return v_result;
end;
$$;
