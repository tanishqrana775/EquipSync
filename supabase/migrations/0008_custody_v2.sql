-- =============================================================================
-- 0008_custody_v2.sql  –  EquipSync  –  Chain of Custody v2 Upgrade
-- Adds resource QR identifiers, custody verification flags, SHA-256 validation,
-- server-side dispute evaluation, and audit logging.
-- Idempotent: safe to run multiple times.
-- =============================================================================

-- ===========================================================================
-- SECTION 1: QR IDENTIFIER GENERATOR & SCHEMA UPGRADES
-- ===========================================================================

-- 1. Helper to generate 'EQS-' + 10 uppercase hex characters (5 bytes from pgcrypto)
create or replace function public.generate_qr_identifier()
returns text
language sql
security definer
set search_path = ''
as $$
  select 'EQS-' || upper(encode(extensions.gen_random_bytes(5), 'hex'));
$$;

revoke execute on function public.generate_qr_identifier() from public, anon;
grant execute on function public.generate_qr_identifier() to authenticated;

-- 2. Add qr_identifier to resources with backfill
alter table public.resources
  add column if not exists qr_identifier text default public.generate_qr_identifier();

update public.resources
set qr_identifier = public.generate_qr_identifier()
where qr_identifier is null;

alter table public.resources
  alter column qr_identifier set not null;

create unique index if not exists idx_resources_qr_identifier
  on public.resources(qr_identifier);

-- 3. custody_events: add qr_verified, flagged, flag_reasons
alter table public.custody_events
  add column if not exists qr_verified boolean not null default false,
  add column if not exists flagged boolean not null default false,
  add column if not exists flag_reasons text[] not null default '{}';

-- 4. incidents: add resolution and resolution_notes
alter table public.incidents
  add column if not exists resolution text check (resolution in ('borrower_responsible', 'no_fault', 'shared_responsibility')),
  add column if not exists resolution_notes text;

-- ===========================================================================
-- SECTION 2: CONDITION RANK IMMUTABLE HELPER
-- ===========================================================================

create or replace function public.condition_rank(c public.condition_rating)
returns integer
language sql
immutable
security definer
set search_path = ''
as $$
  select case c
    when 'excellent'      then 5
    when 'good'           then 4
    when 'minor_wear'     then 3
    when 'minor_damage'   then 3
    when 'damaged'        then 2
    when 'major_damage'   then 2
    when 'missing_parts'  then 2
    when 'non_functional' then 1
    else 0
  end;
$$;

revoke execute on function public.condition_rank(public.condition_rating) from public;
grant execute on function public.condition_rank(public.condition_rating) to authenticated, anon;

-- ===========================================================================
-- SECTION 3: INTERNAL CUSTODY AUDIT LOGGING HELPER
-- ===========================================================================

create or replace function public.log_custody_event(
  p_booking_id uuid,
  p_action     text,
  p_metadata   jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst_id  uuid;
  v_actor_id uuid := (select auth.uid());
begin
  select institution_id into v_inst_id
  from public.bookings
  where id = p_booking_id;

  insert into public.audit_log(
    institution_id,
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    v_inst_id,
    v_actor_id,
    p_action,
    'bookings',
    p_booking_id,
    p_metadata
  );
end;
$$;

revoke execute on function public.log_custody_event(uuid, text, jsonb) from public, anon, authenticated;

-- ===========================================================================
-- SECTION 4: DROP PREVIOUS OVERLOADS
-- ===========================================================================

drop function if exists public.check_out_booking(uuid, jsonb, public.condition_rating, text, jsonb);
drop function if exists public.check_out_booking(uuid, jsonb, public.condition_rating, text, jsonb, text);
drop function if exists public.check_in_booking(uuid, jsonb, public.condition_rating, text, jsonb);
drop function if exists public.check_in_booking(uuid, jsonb, public.condition_rating, text, jsonb, text);
drop function if exists public.inspect_return(uuid, boolean, text);
drop function if exists public.inspect_return(uuid, public.condition_rating, jsonb, text);
drop function if exists public.verify_asset_qr(uuid, text, text);
drop function if exists public.start_checkout(uuid);
drop function if exists public.start_return(uuid);
drop function if exists public.resolve_dispute(uuid, text, text);
drop function if exists public.get_custody_timeline(uuid);
drop function if exists public.regenerate_resource_qr(uuid);

-- ===========================================================================
-- SECTION 5: NEW & UPGRADED RPCS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. regenerate_resource_qr(p_resource_id)
-- ---------------------------------------------------------------------------
create or replace function public.regenerate_resource_qr(p_resource_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_res     public.resources%rowtype;
  v_old_qr  text;
  v_new_qr  text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_res from public.resources where id = p_resource_id for update;
  if not found then raise exception 'not_found'; end if;

  if not public.is_institution_admin(v_res.institution_id) then
    raise exception 'forbidden';
  end if;

  v_old_qr := v_res.qr_identifier;
  v_new_qr := public.generate_qr_identifier();

  update public.resources
  set qr_identifier = v_new_qr,
      updated_at    = now()
  where id = p_resource_id;

  insert into public.audit_log(
    institution_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_res.institution_id,
    v_uid,
    'resources.regenerate_qr',
    'resources',
    p_resource_id,
    jsonb_build_object('old_qr', v_old_qr, 'new_qr', v_new_qr)
  );

  return v_new_qr;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. verify_asset_qr(p_booking_id, p_qr, p_phase)
-- ---------------------------------------------------------------------------
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
    if v_booking.status <> 'approved' then raise exception 'invalid_state'; end if;
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

-- ---------------------------------------------------------------------------
-- 3. start_checkout(p_booking_id) and start_return(p_booking_id)
-- ---------------------------------------------------------------------------
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
  if v_booking.status <> 'approved' then raise exception 'invalid_state'; end if;
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

create or replace function public.start_return(p_booking_id uuid)
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
  if v_booking.status <> 'checked_out' then raise exception 'invalid_state'; end if;

  perform public.log_custody_event(
    p_booking_id,
    'custody.return_initiated',
    jsonb_build_object('returned_by', v_uid)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. check_out_booking (with QR enforcement, 64-char hash, checklist completeness)
-- ---------------------------------------------------------------------------
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
  if v_booking.status <> 'approved' then raise exception 'invalid_state'; end if;

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

  -- c) Photo slots and SHA-256 validation (must be 64 lowercase hex characters)
  v_required_slots := v_resource.required_photo_slots;

  select array_agg(ph ->> 'slot')
  into v_captured_slots
  from jsonb_array_elements(p_photos) ph;

  select array_agg(s)
  into v_missing_slots
  from unnest(v_required_slots) s
  where not (s = any(coalesce(v_captured_slots, '{}'::text[])));

  if v_missing_slots is not null and array_length(v_missing_slots, 1) > 0 then
    raise exception 'missing_photos:%', array_to_string(v_missing_slots, ',');
  end if;

  v_path_prefix := v_booking.institution_id::text || '/' || p_booking_id::text || '/checkout/';

  for v_photo in select * from jsonb_array_elements(p_photos)
  loop
    -- Validate sha256: exactly 64 lowercase hex characters
    if not (coalesce(v_photo ->> 'sha256', '') ~ '^[0-9a-f]{64}$') then
      raise exception 'invalid_hash';
    end if;

    if not ((v_photo ->> 'storage_path') like (v_path_prefix || '%')) then
      raise exception 'forbidden';
    end if;

    v_hash_prefixes := array_append(v_hash_prefixes, substring(v_photo ->> 'sha256' from 1 for 8));

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

  -- d) Notes required when condition is minor_damage or worse
  if public.condition_rank(p_condition) <= 3 and (p_notes is null or trim(p_notes) = '') then
    raise exception 'notes_required';
  end if;

  -- Insert custody event
  insert into public.custody_events(
    booking_id, phase, actor_id, condition, notes, accessory_checks, qr_verified
  ) values (
    p_booking_id, 'checkout', v_uid, p_condition, p_notes,
    coalesce(p_accessory_checks, '[]'::jsonb), true
  );

  -- Transition status
  update public.bookings
  set status = 'checked_out',
      updated_at = now()
  where id = p_booking_id
  returning * into v_result;

  -- Log audit events
  perform public.log_custody_event(
    p_booking_id,
    'custody.photos_uploaded',
    jsonb_build_object(
      'phase', 'checkout',
      'photo_count', jsonb_array_length(p_photos),
      'hash_prefixes', v_hash_prefixes
    )
  );

  perform public.log_custody_event(
    p_booking_id,
    'custody.equipment_accepted',
    jsonb_build_object(
      'condition', p_condition,
      'accessory_count', v_check_count
    )
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. check_in_booking (QR required, automated flagging, incident auto-creation)
-- ---------------------------------------------------------------------------
create or replace function public.check_in_booking(
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
  v_uid             uuid := (select auth.uid());
  v_booking         public.bookings%rowtype;
  v_resource        public.resources%rowtype;
  v_result          public.bookings%rowtype;
  v_checkout_event  public.custody_events%rowtype;
  v_photo           jsonb;
  v_required_slots  text[];
  v_captured_slots  text[];
  v_missing_slots   text[];
  v_path_prefix     text;
  v_hash_prefixes   text[] := '{}';
  v_clean_qr        text;
  v_acc_count       int;
  v_check_count     int;
  v_flagged         boolean := false;
  v_flag_reasons    text[] := '{}';
  v_checkout_rank   int;
  v_current_rank    int;
  v_incident_id     uuid;
  v_admin           record;
  v_out_item        jsonb;
  v_back_item       jsonb;
  v_item_missing    boolean;
  v_inc_sev         public.incident_severity;
  v_inc_type        text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_booking.user_id <> v_uid or v_booking.institution_id <> public.current_institution_id() then
    raise exception 'forbidden';
  end if;
  if v_booking.status <> 'checked_out' then raise exception 'invalid_state'; end if;

  select * into v_resource from public.resources where id = v_booking.resource_id;

  -- 1. QR validation
  v_clean_qr := trim(coalesce(p_qr_identifier, ''));
  if v_clean_qr = '' then raise exception 'qr_required'; end if;
  if v_clean_qr <> v_resource.qr_identifier then raise exception 'qr_mismatch'; end if;

  -- 2. Checklist completeness check
  select count(*) into v_acc_count
  from public.resource_accessories
  where resource_id = v_resource.id;

  select count(*) into v_check_count
  from jsonb_array_elements(coalesce(p_accessory_checks, '[]'::jsonb));

  if v_acc_count > 0 and v_check_count < v_acc_count then
    raise exception 'accessory_checklist_incomplete';
  end if;

  -- 3. Photo validation & storage
  v_required_slots := v_resource.required_photo_slots;

  select array_agg(ph ->> 'slot')
  into v_captured_slots
  from jsonb_array_elements(p_photos) ph;

  select array_agg(s)
  into v_missing_slots
  from unnest(v_required_slots) s
  where not (s = any(coalesce(v_captured_slots, '{}'::text[])));

  if v_missing_slots is not null and array_length(v_missing_slots, 1) > 0 then
    raise exception 'missing_photos:%', array_to_string(v_missing_slots, ',');
  end if;

  v_path_prefix := v_booking.institution_id::text || '/' || p_booking_id::text || '/checkin/';

  for v_photo in select * from jsonb_array_elements(p_photos)
  loop
    if not (coalesce(v_photo ->> 'sha256', '') ~ '^[0-9a-f]{64}$') then
      raise exception 'invalid_hash';
    end if;

    if not ((v_photo ->> 'storage_path') like (v_path_prefix || '%')) then
      raise exception 'forbidden';
    end if;

    v_hash_prefixes := array_append(v_hash_prefixes, substring(v_photo ->> 'sha256' from 1 for 8));

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

  -- 4. Check for condition degradation or missing accessories relative to checkout
  select * into v_checkout_event
  from public.custody_events
  where booking_id = p_booking_id and phase = 'checkout'
  order by created_at desc
  limit 1;

  if v_checkout_event.id is not null then
    v_checkout_rank := public.condition_rank(v_checkout_event.condition);
    v_current_rank  := public.condition_rank(p_condition);

    if v_current_rank < v_checkout_rank then
      v_flagged := true;
      v_flag_reasons := array_append(
        v_flag_reasons,
        'condition_degraded: from ' || v_checkout_event.condition::text || ' to ' || p_condition::text
      );
    end if;

    -- Compare each accessory that was present at checkout
    for v_out_item in select * from jsonb_array_elements(v_checkout_event.accessory_checks)
    loop
      if (v_out_item ->> 'state') = 'present' then
        v_item_missing := true;
        for v_back_item in select * from jsonb_array_elements(p_accessory_checks)
        loop
          if (v_back_item ->> 'accessory_id') = (v_out_item ->> 'accessory_id')
             and (v_back_item ->> 'state') = 'present' then
            v_item_missing := false;
          end if;
        end loop;

        if v_item_missing then
          v_flagged := true;
          v_flag_reasons := array_append(
            v_flag_reasons,
            'missing_accessory: ' || coalesce(v_out_item ->> 'name', v_out_item ->> 'accessory_id')
          );
        end if;
      end if;
    end loop;
  end if;

  -- 5. Notes required when flagged or condition is minor_damage or worse
  if (v_flagged or public.condition_rank(p_condition) <= 3) and (p_notes is null or trim(p_notes) = '') then
    raise exception 'notes_required';
  end if;

  -- Insert custody event
  insert into public.custody_events(
    booking_id, phase, actor_id, condition, notes, accessory_checks,
    qr_verified, flagged, flag_reasons
  ) values (
    p_booking_id, 'checkin', v_uid, p_condition, p_notes,
    coalesce(p_accessory_checks, '[]'::jsonb), true, v_flagged, v_flag_reasons
  );

  update public.bookings
  set status = 'returned',
      updated_at = now()
  where id = p_booking_id
  returning * into v_result;

  -- 6. Auto-create incident on defect & notify admins
  if v_flagged or p_condition in ('damaged', 'major_damage', 'missing_parts', 'non_functional', 'minor_damage') then
    if array_to_string(v_flag_reasons, ' ') like '%missing_accessory%' then
      v_inc_type := 'missing_accessory';
    else
      v_inc_type := 'damage';
    end if;

    if p_condition = 'non_functional' then
      v_inc_sev := 'high';
    elsif p_condition in ('major_damage', 'missing_parts') or v_inc_type = 'missing_accessory' then
      v_inc_sev := 'medium';
    else
      v_inc_sev := 'low';
    end if;

    insert into public.incidents(
      booking_id, resource_id, institution_id, reported_by,
      severity, type, description, status
    ) values (
      p_booking_id, v_booking.resource_id, v_booking.institution_id, v_uid,
      v_inc_sev, v_inc_type,
      coalesce(p_notes, array_to_string(v_flag_reasons, '; ')),
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
        'Return check-in flagged with defect',
        'Check-in flagged for ' || v_resource.name || ': ' || coalesce(p_notes, array_to_string(v_flag_reasons, '; ')),
        '/app/bookings/' || p_booking_id
      );
    end loop;
  end if;

  perform public.log_custody_event(
    p_booking_id,
    'custody.return_submitted',
    jsonb_build_object(
      'condition', p_condition,
      'flagged', v_flagged,
      'flag_reasons', v_flag_reasons,
      'hash_prefixes', v_hash_prefixes
    )
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. inspect_return (server-side dispute vs closure computation)
-- ---------------------------------------------------------------------------
create or replace function public.inspect_return(
  p_booking_id       uuid,
  p_condition        public.condition_rating,
  p_accessory_checks jsonb,
  p_notes            text default null
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
  v_checkout_event public.custody_events%rowtype;
  v_result         public.bookings%rowtype;
  v_checkout_rank  int;
  v_admin_rank     int;
  v_has_defect     boolean := false;
  v_dispute_reason text := '';
  v_out_item       jsonb;
  v_back_item      jsonb;
  v_item_missing   boolean;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;

  if not public.is_institution_admin(v_booking.institution_id) then
    raise exception 'forbidden';
  end if;

  if v_booking.status <> 'returned' then raise exception 'invalid_state'; end if;

  select * into v_resource from public.resources where id = v_booking.resource_id;

  -- Load checkout condition and accessories
  select * into v_checkout_event
  from public.custody_events
  where booking_id = p_booking_id and phase = 'checkout'
  order by created_at desc
  limit 1;

  if v_checkout_event.id is not null then
    v_checkout_rank := public.condition_rank(v_checkout_event.condition);
    v_admin_rank    := public.condition_rank(p_condition);

    if v_admin_rank < v_checkout_rank then
      v_has_defect := true;
      v_dispute_reason := 'Condition degraded from ' || v_checkout_event.condition::text || ' to ' || p_condition::text;
    end if;

    for v_out_item in select * from jsonb_array_elements(v_checkout_event.accessory_checks)
    loop
      if (v_out_item ->> 'state') = 'present' then
        v_item_missing := true;
        for v_back_item in select * from jsonb_array_elements(coalesce(p_accessory_checks, '[]'::jsonb))
        loop
          if (v_back_item ->> 'accessory_id') = (v_out_item ->> 'accessory_id')
             and (v_back_item ->> 'state') = 'present' then
            v_item_missing := false;
          end if;
        end loop;

        if v_item_missing then
          v_has_defect := true;
          v_dispute_reason := v_dispute_reason || ' Missing accessory: ' || coalesce(v_out_item ->> 'name', v_out_item ->> 'accessory_id');
        end if;
      end if;
    end loop;
  end if;

  -- Record inspection custody event
  insert into public.custody_events(
    booking_id, phase, actor_id, condition, notes, accessory_checks,
    qr_verified, flagged, flag_reasons
  ) values (
    p_booking_id, 'inspection', v_uid, p_condition, p_notes,
    coalesce(p_accessory_checks, '[]'::jsonb), true, v_has_defect,
    case when v_has_defect then array[v_dispute_reason] else '{}'::text[] end
  );

  if v_has_defect then
    update public.bookings
    set status = 'disputed',
        updated_at = now()
    where id = p_booking_id
    returning * into v_result;

    -- Ensure an open incident exists
    if not exists (select 1 from public.incidents where booking_id = p_booking_id and status = 'open') then
      insert into public.incidents(
        booking_id, resource_id, institution_id, reported_by,
        severity, type, description, status
      ) values (
        p_booking_id, v_booking.resource_id, v_booking.institution_id, v_uid,
        'medium', 'damage', coalesce(p_notes, v_dispute_reason), 'open'
      );
    end if;

    perform public.log_custody_event(
      p_booking_id,
      'custody.dispute_opened',
      jsonb_build_object('reason', v_dispute_reason, 'notes', p_notes)
    );

    perform public.notify(
      v_booking.user_id,
      'return_disputed',
      'Return disputed upon inspection',
      'Custodian disputed return: ' || coalesce(p_notes, v_dispute_reason),
      '/app/bookings/' || p_booking_id
    );
  else
    update public.bookings
    set status = 'closed',
        updated_at = now()
    where id = p_booking_id
    returning * into v_result;

    -- Resolve auto-created incidents with no_fault
    update public.incidents
    set status = 'resolved',
        resolution = 'no_fault',
        resolution_notes = coalesce(p_notes, 'Inspection passed clean'),
        resolved_by = v_uid,
        resolved_at = now()
    where booking_id = p_booking_id and status = 'open';

    perform public.notify(
      v_booking.user_id,
      'return_accepted',
      'Return accepted & booking closed',
      'Inspection passed in full. Custody closed.',
      '/app/bookings/' || p_booking_id
    );
  end if;

  perform public.log_custody_event(
    p_booking_id,
    'custody.owner_inspected',
    jsonb_build_object(
      'condition', p_condition,
      'has_defect', v_has_defect,
      'result_status', v_result.status
    )
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. resolve_dispute(p_booking_id, p_resolution, p_notes)
-- ---------------------------------------------------------------------------
create or replace function public.resolve_dispute(
  p_booking_id  uuid,
  p_resolution  text,
  p_notes       text
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

  if not public.is_institution_admin(v_booking.institution_id) then
    raise exception 'forbidden';
  end if;

  if v_booking.status <> 'disputed' then
    raise exception 'invalid_state';
  end if;

  if p_resolution not in ('borrower_responsible', 'no_fault', 'shared_responsibility') then
    raise exception 'invalid_state';
  end if;

  if p_notes is null or trim(p_notes) = '' then
    raise exception 'notes_required';
  end if;

  -- Close booking
  update public.bookings
  set status = 'closed',
      updated_at = now()
  where id = p_booking_id
  returning * into v_result;

  -- Resolve all open incidents
  update public.incidents
  set status = 'resolved',
      resolution = p_resolution,
      resolution_notes = p_notes,
      resolved_by = v_uid,
      resolved_at = now()
  where booking_id = p_booking_id and status = 'open';

  perform public.log_custody_event(
    p_booking_id,
    'custody.dispute_resolved',
    jsonb_build_object(
      'resolution', p_resolution,
      'notes', p_notes,
      'resolved_by', v_uid
    )
  );

  perform public.notify(
    v_booking.user_id,
    'dispute_resolved',
    'Custody dispute resolved',
    'Dispute outcome: ' || p_resolution || '. Notes: ' || p_notes,
    '/app/bookings/' || p_booking_id
  );

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. get_custody_timeline(p_booking_id) - Extended with custody.* audit logs
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
    custody_audit_events as (
      select
        al.created_at as occurred_at,
        jsonb_build_object(
          'type',         'audit_action',
          'action',       al.action,
          'occurred_at',  al.created_at,
          'actor_id',     al.actor_id,
          'actor_name',   coalesce(p.full_name, 'System'),
          'actor_role',   coalesce(p.role::text, 'system'),
          'metadata',     coalesce(al.metadata, '{}'::jsonb)
        ) as payload
      from public.audit_log al
      left join public.profiles p on p.id = al.actor_id
      where al.entity_id = p_booking_id
        and (al.action like 'custody.%' or al.action in ('insert', 'update'))
    ),
    custody_evs as (
      select
        ce.created_at as occurred_at,
        jsonb_build_object(
          'type',             'custody_event',
          'phase',            ce.phase,
          'condition',        ce.condition,
          'notes',            ce.notes,
          'accessory_checks', ce.accessory_checks,
          'qr_verified',      ce.qr_verified,
          'flagged',          ce.flagged,
          'flag_reasons',     ce.flag_reasons,
          'actor_id',         ce.actor_id,
          'actor_name',       coalesce(p.full_name, 'Custodian'),
          'actor_role',       coalesce(p.role::text, 'member'),
          'occurred_at',      ce.created_at
        ) as payload
      from public.custody_events ce
      left join public.profiles p on p.id = ce.actor_id
      where ce.booking_id = p_booking_id
    ),
    photo_events as (
      select
        cp.created_at as occurred_at,
        jsonb_build_object(
          'type',                'custody_photo',
          'phase',               cp.phase,
          'slot',                cp.slot,
          'storage_path',        cp.storage_path,
          'sha256',              cp.sha256,
          'client_captured_at',  cp.client_captured_at,
          'taken_by',            cp.taken_by,
          'actor_name',          coalesce(p.full_name, 'Borrower'),
          'occurred_at',         cp.created_at
        ) as payload
      from public.custody_photos cp
      left join public.profiles p on p.id = cp.taken_by
      where cp.booking_id = p_booking_id
    ),
    incident_events as (
      select
        i.created_at as occurred_at,
        jsonb_build_object(
          'type',              'incident',
          'incident_id',       i.id,
          'severity',          i.severity,
          'inc_type',          i.type,
          'description',       i.description,
          'status',            i.status,
          'resolution',        i.resolution,
          'resolution_notes',  i.resolution_notes,
          'reported_by',       i.reported_by,
          'reporter_name',     coalesce(p.full_name, 'Reporter'),
          'occurred_at',       i.created_at
        ) as payload
      from public.incidents i
      left join public.profiles p on p.id = i.reported_by
      where i.booking_id = p_booking_id
    ),
    all_events as (
      select * from custody_audit_events
      union all
      select * from custody_evs
      union all
      select * from photo_events
      union all
      select * from incident_events
    )
    select coalesce(jsonb_agg(payload order by occurred_at asc), '[]'::jsonb)
    from all_events
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.regenerate_resource_qr(uuid) from public, anon;
grant execute on function public.regenerate_resource_qr(uuid) to authenticated;

revoke execute on function public.verify_asset_qr(uuid, text, text) from public, anon;
grant execute on function public.verify_asset_qr(uuid, text, text) to authenticated;

revoke execute on function public.start_checkout(uuid) from public, anon;
grant execute on function public.start_checkout(uuid) to authenticated;

revoke execute on function public.start_return(uuid) from public, anon;
grant execute on function public.start_return(uuid) to authenticated;

revoke execute on function public.check_out_booking(uuid, jsonb, public.condition_rating, text, jsonb, text) from public, anon;
grant execute on function public.check_out_booking(uuid, jsonb, public.condition_rating, text, jsonb, text) to authenticated;

revoke execute on function public.check_in_booking(uuid, jsonb, public.condition_rating, text, jsonb, text) from public, anon;
grant execute on function public.check_in_booking(uuid, jsonb, public.condition_rating, text, jsonb, text) to authenticated;

revoke execute on function public.inspect_return(uuid, public.condition_rating, jsonb, text) from public, anon;
grant execute on function public.inspect_return(uuid, public.condition_rating, jsonb, text) to authenticated;

revoke execute on function public.resolve_dispute(uuid, text, text) from public, anon;
grant execute on function public.resolve_dispute(uuid, text, text) to authenticated;

revoke execute on function public.get_custody_timeline(uuid) from public, anon;
grant execute on function public.get_custody_timeline(uuid) to authenticated;
