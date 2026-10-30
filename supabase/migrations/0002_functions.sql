-- =============================================================================
-- 0002_functions.sql  –  CampusShare  –  Triggers, Helpers & RPCs
-- Depends on: 0001_schema.sql
-- =============================================================================

-- ===========================================================================
-- SECTION 1: HELPER / ACCESSOR FUNCTIONS  (SECURITY DEFINER, STABLE)
-- ===========================================================================

-- Returns the institution_id for the currently authenticated user.
create or replace function public.current_institution_id()
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select institution_id
  from   public.profiles
  where  id = (select auth.uid());
$$;

-- Returns true if the authenticated user is an institution_admin of `inst`.
create or replace function public.is_institution_admin(inst uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from   public.profiles
    where  id             = (select auth.uid())
      and  institution_id = inst
      and  role           = 'institution_admin'
  );
$$;

-- Returns true if the authenticated user is verified (status = 'verified').
create or replace function public.is_verified_member()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from   public.profiles
    where  id                  = (select auth.uid())
      and  verification_status = 'verified'
  );
$$;

-- Returns true if the authenticated user is the booking owner
-- OR is an institution_admin of the booking's institution.
create or replace function public.is_booking_participant(b uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
    from   public.bookings bk
    where  bk.id = b
      and (
        bk.user_id = (select auth.uid())
        or public.is_institution_admin(bk.institution_id)
      )
  );
$$;

-- ===========================================================================
-- SECTION 2: INTERNAL NOTIFY HELPER
-- ===========================================================================

create or replace function public.notify(
  p_user_id uuid,
  p_type    text,
  p_title   text,
  p_body    text,
  p_link    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications(user_id, type, title, body, link)
  values (p_user_id, p_type, p_title, p_body, p_link);
end;
$$;

-- Revoke direct execution from every client role; only SECURITY DEFINER callers use it.
revoke execute on function public.notify(uuid, text, text, text, text) from public, anon, authenticated;

-- ===========================================================================
-- SECTION 3: TRIGGER – handle_new_user
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
begin
  -- Parse raw_user_meta_data
  v_role           := new.raw_user_meta_data ->> 'role';
  v_full_name      := coalesce(new.raw_user_meta_data ->> 'full_name', '');
  v_user_type      := new.raw_user_meta_data ->> 'user_type';
  v_institution_id := (new.raw_user_meta_data ->> 'institution_id')::uuid;
  v_inst_name      := new.raw_user_meta_data ->> 'institution_name';
  v_inst_type      := new.raw_user_meta_data ->> 'institution_type';
  v_email_domain   := new.raw_user_meta_data ->> 'email_domain';

  if v_role = 'institution_admin' and v_inst_name is not null then
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
    );

  elsif v_role = 'institution_admin' and v_inst_name is null then
    raise exception 'invalid_institution';

  else
    -- Treat as member; any other role value is silently coerced to 'member'
    if v_institution_id is null then
      raise exception 'invalid_institution';
    end if;

    if not exists (
      select 1 from public.institutions where id = v_institution_id
    ) then
      raise exception 'invalid_institution';
    end if;

    insert into public.profiles(
      id, institution_id, full_name, role, user_type, verification_status
    ) values (
      new.id,
      v_institution_id,
      v_full_name,
      'member',
      v_user_type::public.user_type,
      'pending'
    );
  end if;

  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===========================================================================
-- SECTION 4: TRIGGER – set bookings.institution_id from resource
-- ===========================================================================

create or replace function public.set_booking_institution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select institution_id
  into   new.institution_id
  from   public.resources
  where  id = new.resource_id;

  if new.institution_id is null then
    raise exception 'resource_unavailable';
  end if;

  return new;
end;
$$;

create trigger trg_bookings_set_institution
  before insert on public.bookings
  for each row execute function public.set_booking_institution();

-- ===========================================================================
-- SECTION 5: AUDIT LOG TRIGGER
-- ===========================================================================

create or replace function public.log_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_action        text;
  v_entity_type   text;
  v_entity_id     uuid;
  v_institution_id uuid;
  v_actor_id      uuid;
  v_metadata      jsonb;
begin
  v_actor_id := (select auth.uid());
  v_entity_type := TG_TABLE_NAME;

  -- Determine action verb
  if    TG_OP = 'INSERT' then v_action := 'insert';
  elsif TG_OP = 'UPDATE' then v_action := 'update';
  elsif TG_OP = 'DELETE' then v_action := 'delete';
  end if;

  -- Per-table entity extraction
  case TG_TABLE_NAME
    when 'bookings' then
      -- Only log status changes
      if TG_OP = 'UPDATE' and OLD.status = NEW.status then
        return NEW;
      end if;
      v_entity_id      := NEW.id;
      v_institution_id := NEW.institution_id;
      v_metadata       := jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'resource_id', NEW.resource_id,
        'user_id', NEW.user_id
      );

    when 'custody_events' then
      v_entity_id      := NEW.id;
      v_metadata       := jsonb_build_object(
        'booking_id', NEW.booking_id,
        'phase', NEW.phase,
        'condition', NEW.condition
      );
      select institution_id into v_institution_id
      from public.bookings where id = NEW.booking_id;

    when 'custody_photos' then
      v_entity_id      := NEW.id;
      v_metadata       := jsonb_build_object(
        'booking_id', NEW.booking_id,
        'phase', NEW.phase,
        'slot', NEW.slot
      );
      select institution_id into v_institution_id
      from public.bookings where id = NEW.booking_id;

    when 'incidents' then
      v_entity_id      := NEW.id;
      v_institution_id := NEW.institution_id;
      v_metadata       := jsonb_build_object(
        'booking_id', NEW.booking_id,
        'severity', NEW.severity,
        'type', NEW.type,
        'status', NEW.status
      );

    when 'resources' then
      -- Only log availability/status changes
      if TG_OP = 'UPDATE'
         and OLD.is_available = NEW.is_available
         and OLD.status = NEW.status then
        return NEW;
      end if;
      v_entity_id      := NEW.id;
      v_institution_id := NEW.institution_id;
      v_metadata       := jsonb_build_object(
        'old_is_available', OLD.is_available,
        'new_is_available', NEW.is_available,
        'old_status', OLD.status,
        'new_status', NEW.status
      );

    when 'profiles' then
      -- Only log verification_status changes
      if TG_OP = 'UPDATE' and OLD.verification_status = NEW.verification_status then
        return NEW;
      end if;
      v_entity_id      := NEW.id;
      v_institution_id := NEW.institution_id;
      v_metadata       := jsonb_build_object(
        'old_verification_status', OLD.verification_status,
        'new_verification_status', NEW.verification_status
      );

    when 'released_slots' then
      v_entity_id      := NEW.id;
      v_institution_id := NEW.institution_id;
      v_metadata       := jsonb_build_object(
        'booking_id', NEW.booking_id,
        'status', NEW.status
      );

    else
      return coalesce(NEW, OLD);
  end case;

  insert into public.audit_log(institution_id, actor_id, action, entity_type, entity_id, metadata)
  values (v_institution_id, v_actor_id, v_action, v_entity_type, v_entity_id, v_metadata);

  return coalesce(NEW, OLD);
end;
$$;

-- Attach audit triggers
create trigger trg_audit_bookings
  after insert or update on public.bookings
  for each row execute function public.log_audit();

create trigger trg_audit_custody_events
  after insert on public.custody_events
  for each row execute function public.log_audit();

create trigger trg_audit_custody_photos
  after insert on public.custody_photos
  for each row execute function public.log_audit();

create trigger trg_audit_incidents
  after insert or update on public.incidents
  for each row execute function public.log_audit();

create trigger trg_audit_resources
  after update on public.resources
  for each row execute function public.log_audit();

create trigger trg_audit_profiles
  after update on public.profiles
  for each row execute function public.log_audit();

create trigger trg_audit_released_slots
  after insert or update on public.released_slots
  for each row execute function public.log_audit();

-- ===========================================================================
-- SECTION 6: RPCs
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- request_booking
-- ---------------------------------------------------------------------------
create or replace function public.request_booking(
  p_resource_id    uuid,
  p_start          timestamptz,
  p_end            timestamptz,
  p_purpose        text,
  p_supervisor_name text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid           uuid := (select auth.uid());
  v_profile       public.profiles%rowtype;
  v_resource      public.resources%rowtype;
  v_rules         public.eligibility_rules%rowtype;
  v_duration_min  int;
  v_lead_min      int;
  v_missing_quals text[];
  v_new_booking   public.bookings%rowtype;
  v_initial_status public.booking_status;
  v_admin         record;
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
      '/dashboard/bookings/' || v_new_booking.id
    );
  end loop;

  return v_new_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- decide_booking
-- ---------------------------------------------------------------------------
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
      decision_note = p_note
  where id = p_booking_id
  returning * into v_result;

  perform public.notify(
    v_result.user_id,
    case when p_approve then 'booking_approved' else 'booking_rejected' end,
    case when p_approve then 'Booking approved' else 'Booking rejected' end,
    case when p_approve
         then 'Your booking has been approved.'
         else coalesce('Your booking was rejected: ' || p_note, 'Your booking was rejected.')
    end,
    '/bookings/' || p_booking_id
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_booking
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_result public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_booking.user_id <> v_uid then raise exception 'forbidden'; end if;
  if v_booking.status not in ('pending', 'approved') then raise exception 'invalid_state'; end if;

  update public.bookings
  set status = 'cancelled'
  where id = p_booking_id
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_booking
-- ---------------------------------------------------------------------------
create or replace function public.release_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_result public.bookings%rowtype;
  v_slot_id uuid;
  v_entry  record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_booking.user_id <> v_uid then raise exception 'forbidden'; end if;
  if v_booking.status <> 'approved' then raise exception 'invalid_state'; end if;

  -- Mark booking released
  update public.bookings set status = 'released' where id = p_booking_id
  returning * into v_result;

  -- Insert open released_slot
  insert into public.released_slots(
    booking_id, resource_id, institution_id, start_at, end_at, released_by, status
  ) values (
    p_booking_id, v_booking.resource_id, v_booking.institution_id,
    v_booking.start_at, v_booking.end_at, v_uid, 'open'
  )
  returning id into v_slot_id;

  -- Notify matching waitlist entries (FIFO, status='waiting' for that resource window)
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
      'A released booking slot matches your waitlist request.',
      '/slots/' || v_slot_id
    );
  end loop;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- claim_released_slot
-- ---------------------------------------------------------------------------
create or replace function public.claim_released_slot(p_slot_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_slot   public.released_slots%rowtype;
  v_new_bk public.bookings%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_verified_member() then raise exception 'not_verified'; end if;

  select * into v_slot from public.released_slots where id = p_slot_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_slot.status <> 'open' then raise exception 'invalid_state'; end if;

  -- Reuse the same eligibility checks via request_booking internals
  -- (call request_booking which validates and inserts)
  select * into v_new_bk
  from public.request_booking(
    v_slot.resource_id, v_slot.start_at, v_slot.end_at, 'Claimed from released slot', null
  );

  -- Mark slot claimed
  update public.released_slots
  set status             = 'claimed',
      claimed_by         = v_uid,
      claimed_booking_id = v_new_bk.id
  where id = p_slot_id;

  -- Cancel offered waitlist entries for this slot's resource/window
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

-- ---------------------------------------------------------------------------
-- join_waitlist
-- ---------------------------------------------------------------------------
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
  v_uid  uuid := (select auth.uid());
  v_entry public.waitlist_entries%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_verified_member() then raise exception 'not_verified'; end if;

  insert into public.waitlist_entries(resource_id, user_id, desired_start, desired_end, status)
  values (p_resource_id, v_uid, p_start, p_end, 'waiting')
  returning * into v_entry;

  return v_entry;
end;
$$;

-- ---------------------------------------------------------------------------
-- leave_waitlist
-- ---------------------------------------------------------------------------
create or replace function public.leave_waitlist(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  update public.waitlist_entries
  set status = 'cancelled'
  where id = p_entry_id and user_id = v_uid;

  if not found then raise exception 'not_found'; end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- my_waitlist  (returns position correctly regardless of RLS)
-- ---------------------------------------------------------------------------
create or replace function public.my_waitlist()
returns table (
  id            uuid,
  resource_id   uuid,
  desired_start timestamptz,
  desired_end   timestamptz,
  status        public.waitlist_status,
  created_at    timestamptz,
  "position"    bigint
)
language sql
security definer
stable
set search_path = ''
as $$
  with queue as (
    select
      we_all.id,
      row_number() over (
        partition by we_all.resource_id
        order by we_all.created_at asc
      ) as pos
    from public.waitlist_entries we_all
    where we_all.status = 'waiting'
  )
  select
    we.id,
    we.resource_id,
    we.desired_start,
    we.desired_end,
    we.status,
    we.created_at,
    q.pos as "position"
  from public.waitlist_entries we
  left join queue q on q.id = we.id
  where we.user_id = (select auth.uid())
    and we.status not in ('cancelled', 'expired')
  order by we.created_at desc;
$$;

-- ---------------------------------------------------------------------------
-- verify_member
-- ---------------------------------------------------------------------------
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
  v_uid    uuid := (select auth.uid());
  v_target public.profiles%rowtype;
  v_result public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_target from public.profiles where id = p_user_id;
  if not found then raise exception 'not_found'; end if;

  if not public.is_institution_admin(v_target.institution_id) then
    raise exception 'forbidden';
  end if;

  update public.profiles
  set verification_status = case when p_approve then 'verified'::public.verification_status
                                 else 'rejected'::public.verification_status end
  where id = p_user_id
  returning * into v_result;

  perform public.notify(
    p_user_id,
    case when p_approve then 'member_verified' else 'member_rejected' end,
    case when p_approve then 'Account verified' else 'Account verification rejected' end,
    case when p_approve then 'Your account has been verified. You can now make bookings.'
         else 'Your account verification was rejected. Contact your administrator.' end,
    '/profile'
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- verify_qualification
-- ---------------------------------------------------------------------------
create or replace function public.verify_qualification(
  p_user_id          uuid,
  p_qualification_id uuid,
  p_approve          boolean
)
returns public.user_qualifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_qual public.qualifications%rowtype;
  v_result public.user_qualifications%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_qual from public.qualifications where id = p_qualification_id;
  if not found then raise exception 'not_found'; end if;

  if not public.is_institution_admin(v_qual.institution_id) then
    raise exception 'forbidden';
  end if;

  update public.user_qualifications
  set status      = case when p_approve then 'verified'::public.verification_status
                         else 'rejected'::public.verification_status end,
      verified_by  = v_uid,
      verified_at  = now()
  where user_id          = p_user_id
    and qualification_id = p_qualification_id
  returning * into v_result;

  if not found then raise exception 'not_found'; end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_out_booking
-- ---------------------------------------------------------------------------
create or replace function public.check_out_booking(
  p_booking_id      uuid,
  p_photos          jsonb,
  p_condition       public.condition_rating,
  p_notes           text,
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
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_booking.user_id <> v_uid then raise exception 'forbidden'; end if;
  if v_booking.status <> 'approved' then raise exception 'invalid_state'; end if;

  -- Allow 15 minutes early check-out
  if now() < (v_booking.start_at - interval '15 minutes') then
    raise exception 'outside_window';
  end if;
  if now() > v_booking.end_at then
    raise exception 'outside_window';
  end if;

  -- Load resource to get required_photo_slots
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

  -- Validate storage path prefix
  v_path_prefix := v_booking.institution_id::text || '/' || p_booking_id::text || '/checkout/';

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
      'checkout',
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
  values (p_booking_id, 'checkout', v_uid, p_condition, p_notes, coalesce(p_accessory_checks, '[]'::jsonb));

  -- Update booking status
  update public.bookings set status = 'checked_out' where id = p_booking_id returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_in_booking
-- ---------------------------------------------------------------------------
create or replace function public.check_in_booking(
  p_booking_id      uuid,
  p_photos          jsonb,
  p_condition       public.condition_rating,
  p_notes           text,
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

  -- Auto-create incident if condition is bad
  if p_condition in ('damaged', 'missing_parts') then
    insert into public.incidents(
      booking_id, resource_id, institution_id, reported_by,
      severity, type, description, status
    ) values (
      p_booking_id, v_booking.resource_id, v_booking.institution_id, v_uid,
      'medium',
      case when p_condition = 'damaged' then 'damage' else 'missing_accessory' end,
      coalesce(p_notes, 'Condition issue reported during check-in.'),
      'open'
    )
    returning id into v_incident_id;

    -- Notify admins
    for v_admin in
      select id from public.profiles
      where institution_id = v_booking.institution_id and role = 'institution_admin'
    loop
      perform public.notify(
        v_admin.id,
        'incident_reported',
        'Incident reported on return',
        'A condition issue was noted during check-in for resource: ' || v_resource.name,
        '/dashboard/incidents/' || v_incident_id
      );
    end loop;
  end if;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- inspect_return
-- ---------------------------------------------------------------------------
create or replace function public.inspect_return(
  p_booking_id uuid,
  p_accept     boolean,
  p_notes      text default null
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
  v_inc_id  uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.is_institution_admin(v_booking.institution_id) then raise exception 'forbidden'; end if;
  if v_booking.status <> 'returned' then raise exception 'invalid_state'; end if;

  update public.bookings
  set status = case when p_accept then 'closed'::public.booking_status else 'disputed'::public.booking_status end
  where id = p_booking_id
  returning * into v_result;

  -- Record inspection custody event
  insert into public.custody_events(booking_id, phase, actor_id, condition, notes)
  values (p_booking_id, 'inspection', v_uid, 'good', p_notes);

  if not p_accept then
    insert into public.incidents(
      booking_id, resource_id, institution_id, reported_by,
      severity, type, description, status
    ) values (
      p_booking_id, v_booking.resource_id, v_booking.institution_id, v_uid,
      'high', 'other',
      coalesce(p_notes, 'Return inspection rejected.'),
      'open'
    )
    returning id into v_inc_id;
  end if;

  perform public.notify(
    v_booking.user_id,
    case when p_accept then 'return_accepted' else 'return_disputed' end,
    case when p_accept then 'Return accepted' else 'Return disputed' end,
    case when p_accept then 'Your return has been accepted and the booking is closed.'
         else coalesce('Your return was disputed: ' || p_notes, 'Your return was disputed.')
    end,
    '/bookings/' || p_booking_id
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- report_incident
-- ---------------------------------------------------------------------------
create or replace function public.report_incident(
  p_booking_id  uuid,
  p_severity    public.incident_severity,
  p_type        text,
  p_description text
)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_booking public.bookings%rowtype;
  v_result  public.incidents%rowtype;
  v_admin   record;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_booking_participant(p_booking_id) then raise exception 'forbidden'; end if;

  select * into v_booking from public.bookings where id = p_booking_id;

  insert into public.incidents(
    booking_id, resource_id, institution_id, reported_by,
    severity, type, description, status
  ) values (
    p_booking_id, v_booking.resource_id, v_booking.institution_id, v_uid,
    p_severity, p_type, p_description, 'open'
  )
  returning * into v_result;

  for v_admin in
    select id from public.profiles
    where institution_id = v_booking.institution_id and role = 'institution_admin'
  loop
    perform public.notify(
      v_admin.id, 'incident_reported', 'Incident reported',
      p_description,
      '/dashboard/incidents/' || v_result.id
    );
  end loop;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- resolve_incident
-- ---------------------------------------------------------------------------
create or replace function public.resolve_incident(p_incident_id uuid)
returns public.incidents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_inc    public.incidents%rowtype;
  v_result public.incidents%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_inc from public.incidents where id = p_incident_id for update;
  if not found then raise exception 'not_found'; end if;
  if not public.is_institution_admin(v_inc.institution_id) then raise exception 'forbidden'; end if;
  if v_inc.status <> 'open' then raise exception 'invalid_state'; end if;

  update public.incidents
  set status      = 'resolved',
      resolved_by  = v_uid,
      resolved_at  = now()
  where id = p_incident_id
  returning * into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_custody_timeline
-- ---------------------------------------------------------------------------
create or replace function public.get_custody_timeline(p_booking_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_booking_participant(p_booking_id) then raise exception 'forbidden'; end if;

  return (
    with
    status_events as (
      select
        'status_change'         as item_type,
        al.created_at           as occurred_at,
        al.actor_id,
        jsonb_build_object(
          'type',       'status_change',
          'old_status', al.metadata ->> 'old_status',
          'new_status', al.metadata ->> 'new_status',
          'actor_id',   al.actor_id,
          'occurred_at', al.created_at
        ) as payload
      from public.audit_log al
      where al.entity_type = 'bookings'
        and al.entity_id   = p_booking_id
    ),
    custody_evs as (
      select
        'custody_event'   as item_type,
        ce.created_at     as occurred_at,
        ce.actor_id,
        jsonb_build_object(
          'type',             'custody_event',
          'phase',            ce.phase,
          'condition',        ce.condition,
          'notes',            ce.notes,
          'accessory_checks', ce.accessory_checks,
          'actor_id',         ce.actor_id,
          'occurred_at',      ce.created_at
        ) as payload
      from public.custody_events ce
      where ce.booking_id = p_booking_id
    ),
    photo_events as (
      select
        'custody_photo'   as item_type,
        cp.created_at     as occurred_at,
        cp.taken_by       as actor_id,
        jsonb_build_object(
          'type',                'custody_photo',
          'phase',               cp.phase,
          'slot',                cp.slot,
          'storage_path',        cp.storage_path,
          'sha256',              cp.sha256,
          'client_captured_at',  cp.client_captured_at,
          'taken_by',            cp.taken_by,
          'occurred_at',         cp.created_at
        ) as payload
      from public.custody_photos cp
      where cp.booking_id = p_booking_id
    ),
    incident_events as (
      select
        'incident'        as item_type,
        i.created_at      as occurred_at,
        i.reported_by     as actor_id,
        jsonb_build_object(
          'type',        'incident',
          'severity',    i.severity,
          'inc_type',    i.type,
          'description', i.description,
          'status',      i.status,
          'reported_by', i.reported_by,
          'occurred_at', i.created_at
        ) as payload
      from public.incidents i
      where i.booking_id = p_booking_id
    ),
    all_events as (
      select * from status_events
      union all
      select * from custody_evs
      union all
      select * from photo_events
      union all
      select * from incident_events
    )
    select jsonb_agg(payload order by occurred_at)
    from all_events
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- institution_stats
-- ---------------------------------------------------------------------------
create or replace function public.institution_stats(p_institution_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_institution_admin(p_institution_id) then raise exception 'forbidden'; end if;

  return (
    select jsonb_build_object(
      'total_resources',    (select count(*) from public.resources where institution_id = p_institution_id and status = 'active'),
      'in_use_now',         (select count(*) from public.bookings where institution_id = p_institution_id and status = 'checked_out'),
      'unused_30d',         (
        select count(*)
        from   public.resources r
        where  r.institution_id = p_institution_id
          and  r.status = 'active'
          and  not exists (
            select 1 from public.bookings b
            where  b.resource_id = r.id
              and  b.status in ('approved','checked_out','returned','closed')
              and  b.start_at >= now() - interval '30 days'
          )
      ),
      'pending_approvals',  (select count(*) from public.bookings where institution_id = p_institution_id and status = 'pending')
    )
  );
end;
$$;

-- ===========================================================================
-- SECTION 7: VIEWS
-- ===========================================================================

-- resource_utilisation view
create or replace view public.resource_utilisation
with (security_invoker = true)
as
select
  r.id                as resource_id,
  r.institution_id,
  coalesce(
    (
      select sum(
        extract(epoch from least(b.end_at, now()) - greatest(b.start_at, now() - interval '30 days')) / 60
      )
      from public.bookings b
      where b.resource_id = r.id
        and b.status in ('approved', 'checked_out', 'returned', 'closed')
        and b.end_at   >= now() - interval '30 days'
        and b.start_at <= now()
    ), 0
  )                   as booked_minutes_30d,
  coalesce(
    (
      select sum(
        extract(epoch from
          (interval '1 minute' * (
            extract(hour from raw.end_time) * 60 + extract(minute from raw.end_time)
            - extract(hour from raw.start_time) * 60 - extract(minute from raw.start_time)
          ))
        ) / 60 * 30  -- 30 days approximation
      )
      from public.resource_availability_windows raw
      where raw.resource_id = r.id
    ), 0
  )                   as available_minutes_30d,
  case
    when coalesce(
      (
        select sum(
          extract(epoch from
            (interval '1 minute' * (
              extract(hour from raw.end_time) * 60 + extract(minute from raw.end_time)
              - extract(hour from raw.start_time) * 60 - extract(minute from raw.start_time)
            ))
          ) / 60 * 30
        )
        from public.resource_availability_windows raw
        where raw.resource_id = r.id
      ), 0
    ) = 0 then 0
    else round(
      coalesce(
        (
          select sum(
            extract(epoch from least(b.end_at, now()) - greatest(b.start_at, now() - interval '30 days')) / 60
          )
          from public.bookings b
          where b.resource_id = r.id
            and b.status in ('approved', 'checked_out', 'returned', 'closed')
            and b.end_at   >= now() - interval '30 days'
            and b.start_at <= now()
        ), 0
      ) * 100.0 /
      (
        select sum(
          extract(epoch from
            (interval '1 minute' * (
              extract(hour from raw.end_time) * 60 + extract(minute from raw.end_time)
              - extract(hour from raw.start_time) * 60 - extract(minute from raw.start_time)
            ))
          ) / 60 * 30
        )
        from public.resource_availability_windows raw
        where raw.resource_id = r.id
      )
    , 2)
  end                 as utilisation_pct,
  case
    when coalesce(
      (
        select sum(
          extract(epoch from
            (interval '1 minute' * (
              extract(hour from raw.end_time) * 60 + extract(minute from raw.end_time)
              - extract(hour from raw.start_time) * 60 - extract(minute from raw.start_time)
            ))
          ) / 60 * 30
        )
        from public.resource_availability_windows raw
        where raw.resource_id = r.id
      ), 0
    ) = 0 then false
    else (
      coalesce(
        (
          select sum(
            extract(epoch from least(b.end_at, now()) - greatest(b.start_at, now() - interval '30 days')) / 60
          )
          from public.bookings b
          where b.resource_id = r.id
            and b.status in ('approved', 'checked_out', 'returned', 'closed')
            and b.end_at   >= now() - interval '30 days'
            and b.start_at <= now()
        ), 0
      ) * 100.0 /
      (
        select sum(
          extract(epoch from
            (interval '1 minute' * (
              extract(hour from raw.end_time) * 60 + extract(minute from raw.end_time)
              - extract(hour from raw.start_time) * 60 - extract(minute from raw.start_time)
            ))
          ) / 60 * 30
        )
        from public.resource_availability_windows raw
        where raw.resource_id = r.id
      )
    ) < 30
  end                 as is_underutilised
from public.resources r
where r.status = 'active';

-- institution_directory view (public, granted to anon + authenticated)
create or replace view public.institution_directory
with (security_invoker = true)
as
select id, name, type
from   public.institutions;

grant select on public.institution_directory to anon, authenticated;

-- ===========================================================================
-- SECTION 8: GRANTS FOR RPCs
-- ===========================================================================

-- Revoke all from public/anon first, then grant only to authenticated
revoke execute on function public.request_booking(uuid, timestamptz, timestamptz, text, text)           from public, anon;
revoke execute on function public.decide_booking(uuid, boolean, text)                                    from public, anon;
revoke execute on function public.cancel_booking(uuid)                                                   from public, anon;
revoke execute on function public.release_booking(uuid)                                                  from public, anon;
revoke execute on function public.claim_released_slot(uuid)                                              from public, anon;
revoke execute on function public.join_waitlist(uuid, timestamptz, timestamptz)                         from public, anon;
revoke execute on function public.leave_waitlist(uuid)                                                   from public, anon;
revoke execute on function public.my_waitlist()                                                          from public, anon;
revoke execute on function public.verify_member(uuid, boolean)                                          from public, anon;
revoke execute on function public.verify_qualification(uuid, uuid, boolean)                             from public, anon;
revoke execute on function public.check_out_booking(uuid, jsonb, public.condition_rating, text, jsonb)  from public, anon;
revoke execute on function public.check_in_booking(uuid, jsonb, public.condition_rating, text, jsonb)   from public, anon;
revoke execute on function public.inspect_return(uuid, boolean, text)                                   from public, anon;
revoke execute on function public.report_incident(uuid, public.incident_severity, text, text)           from public, anon;
revoke execute on function public.resolve_incident(uuid)                                                 from public, anon;
revoke execute on function public.get_custody_timeline(uuid)                                            from public, anon;
revoke execute on function public.institution_stats(uuid)                                               from public, anon;
revoke execute on function public.is_institution_admin(uuid)                                            from public, anon;
revoke execute on function public.is_verified_member()                                                  from public, anon;
revoke execute on function public.is_booking_participant(uuid)                                          from public, anon;
revoke execute on function public.current_institution_id()                                              from public, anon;

grant execute on function public.request_booking(uuid, timestamptz, timestamptz, text, text)           to authenticated;
grant execute on function public.decide_booking(uuid, boolean, text)                                    to authenticated;
grant execute on function public.cancel_booking(uuid)                                                   to authenticated;
grant execute on function public.release_booking(uuid)                                                  to authenticated;
grant execute on function public.claim_released_slot(uuid)                                              to authenticated;
grant execute on function public.join_waitlist(uuid, timestamptz, timestamptz)                         to authenticated;
grant execute on function public.leave_waitlist(uuid)                                                   to authenticated;
grant execute on function public.my_waitlist()                                                          to authenticated;
grant execute on function public.verify_member(uuid, boolean)                                          to authenticated;
grant execute on function public.verify_qualification(uuid, uuid, boolean)                             to authenticated;
grant execute on function public.check_out_booking(uuid, jsonb, public.condition_rating, text, jsonb)  to authenticated;
grant execute on function public.check_in_booking(uuid, jsonb, public.condition_rating, text, jsonb)   to authenticated;
grant execute on function public.inspect_return(uuid, boolean, text)                                   to authenticated;
grant execute on function public.report_incident(uuid, public.incident_severity, text, text)           to authenticated;
grant execute on function public.resolve_incident(uuid)                                                 to authenticated;
grant execute on function public.get_custody_timeline(uuid)                                            to authenticated;
grant execute on function public.institution_stats(uuid)                                               to authenticated;
grant execute on function public.current_institution_id()                                              to authenticated;
grant execute on function public.is_institution_admin(uuid)                                            to anon, authenticated;
grant execute on function public.is_verified_member()                                                  to anon, authenticated;
grant execute on function public.is_booking_participant(uuid)                                          to anon, authenticated;
