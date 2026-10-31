-- =============================================================================
-- 0012_custody_hub.sql – CampusShare / EquipSync
-- Chain of Custody Hub, Spot Audits, Redacted Timeline & Audit Search
-- =============================================================================

-- ===========================================================================
-- SECTION 1: ASSET AUDITS TABLE & STORAGE BUCKET
-- ===========================================================================

create table if not exists public.asset_audits (
  id uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  institution_id uuid not null references public.institutions(id) on delete cascade,
  performed_by uuid not null references public.profiles(id) on delete restrict,
  condition public.condition_rating not null,
  accessory_checks jsonb not null default '[]'::jsonb,
  photos jsonb not null default '[]'::jsonb,
  notes text,
  flagged boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_asset_audits_resource_id on public.asset_audits(resource_id);
create index if not exists idx_asset_audits_institution_id on public.asset_audits(institution_id);
create index if not exists idx_asset_audits_created_at on public.asset_audits(created_at desc);

alter table public.asset_audits enable row level security;
revoke all on public.asset_audits from public, anon, authenticated;
grant select on public.asset_audits to authenticated;

drop policy if exists "asset_audits_select_admin" on public.asset_audits;
create policy "asset_audits_select_admin"
  on public.asset_audits for select
  to authenticated
  using (public.is_institution_admin(institution_id));

-- Immutable audits trigger: block update and delete
create or replace function public.trg_block_asset_audits_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'asset_audits_immutable: updates and deletions are not permitted';
end;
$$;

drop trigger if exists trg_asset_audits_no_mutation on public.asset_audits;
create trigger trg_asset_audits_no_mutation
  before update or delete on public.asset_audits
  for each row execute function public.trg_block_asset_audits_mutation();

-- Private bucket 'asset-audit-photos'
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'asset-audit-photos',
  'asset-audit-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "asset_audit_photos_insert_admin" on storage.objects;
create policy "asset_audit_photos_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'asset-audit-photos'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

drop policy if exists "asset_audit_photos_select_admin" on storage.objects;
create policy "asset_audit_photos_select_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'asset-audit-photos'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

-- ===========================================================================
-- SECTION 2: RPC resolve_asset_qr
-- ===========================================================================

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
  v_can_audit   boolean := false;
  v_now         timestamptz := now();
  v_booking     record;
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

  return jsonb_build_object(
    'resource_id', v_resource.id,
    'name',        v_resource.name,
    'asset_tag',   v_resource.asset_tag,
    'status',      v_resource.status,
    'actions',     v_actions,
    'can_audit',   v_can_audit
  );
end;
$$;

-- ===========================================================================
-- SECTION 3: RPC record_asset_audit
-- ===========================================================================

create or replace function public.record_asset_audit(
  p_resource_id       uuid,
  p_qr                text,
  p_photos            jsonb,
  p_condition         public.condition_rating,
  p_accessory_checks  jsonb,
  p_notes             text
)
returns public.asset_audits
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id         uuid;
  v_inst_id           uuid;
  v_resource          public.resources%rowtype;
  v_clean_qr          text;
  v_item              jsonb;
  v_slot              text;
  v_sha               text;
  v_required_slot     text;
  v_photo_slots       text[] := '{}';
  v_last_rank         int := 5;
  v_current_rank      int;
  v_flagged           boolean := false;
  v_audit_row         public.asset_audits%rowtype;
  v_acc_item          jsonb;
  v_acc_state         text;
  v_acc_req           boolean;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  v_inst_id := public.current_institution_id();
  if v_inst_id is null or not public.is_institution_admin(v_inst_id) then
    raise exception 'forbidden';
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id and institution_id = v_inst_id;

  if not found then
    raise exception 'not_found';
  end if;

  -- 1. QR Validation
  v_clean_qr := trim(coalesce(p_qr, ''));
  if v_clean_qr = '' then
    raise exception 'qr_required';
  end if;

  if v_resource.qr_identifier is distinct from v_clean_qr then
    raise exception 'qr_mismatch';
  end if;

  -- 2. Validate photos & sha256
  if p_photos is null or jsonb_array_length(p_photos) = 0 then
    raise exception 'missing_photos';
  end if;

  for v_item in select * from jsonb_array_elements(p_photos)
  loop
    v_slot := v_item ->> 'slot';
    v_sha  := v_item ->> 'sha256';

    if v_sha is null or v_sha !~ '^[0-9a-f]{64}$' then
      raise exception 'invalid_hash';
    end if;

    v_photo_slots := array_append(v_photo_slots, v_slot);
  end loop;

  -- Required slots check
  if v_resource.required_photo_slots is not null then
    foreach v_required_slot in array v_resource.required_photo_slots
    loop
      if not (v_required_slot = any(v_photo_slots)) then
        raise exception 'missing_photos:%', array_to_string(v_resource.required_photo_slots, ',');
      end if;
    end loop;
  end if;

  -- 3. Notes required for minor_damage or worse
  v_current_rank := public.condition_rank(p_condition);
  if v_current_rank <= 3 and (p_notes is null or trim(p_notes) = '') then
    raise exception 'notes_required';
  end if;

  -- 4. Determine last known condition rank
  select public.condition_rank(condition) into v_last_rank
  from (
    select condition, created_at from public.asset_audits where resource_id = p_resource_id
    union all
    select condition, created_at from public.custody_events where booking_id in (
      select id from public.bookings where resource_id = p_resource_id
    )
    order by created_at desc
    limit 1
  ) t;

  if v_last_rank is not null and v_current_rank < v_last_rank then
    v_flagged := true;
  end if;

  -- Check accessories missing
  if p_accessory_checks is not null then
    for v_acc_item in select * from jsonb_array_elements(p_accessory_checks)
    loop
      v_acc_state := v_acc_item ->> 'state';
      if v_acc_state in ('missing', 'damaged') then
        v_flagged := true;
      end if;
    end loop;
  end if;

  -- 5. Insert audit record
  insert into public.asset_audits (
    resource_id,
    institution_id,
    performed_by,
    condition,
    accessory_checks,
    photos,
    notes,
    flagged
  ) values (
    p_resource_id,
    v_inst_id,
    v_caller_id,
    p_condition,
    coalesce(p_accessory_checks, '[]'::jsonb),
    p_photos,
    p_notes,
    v_flagged
  )
  returning * into v_audit_row;

  -- Log audit event
  insert into public.audit_log (
    institution_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_inst_id,
    v_caller_id,
    'custody.asset_audit',
    'resource',
    p_resource_id,
    jsonb_build_object(
      'audit_id',  v_audit_row.id,
      'condition', p_condition,
      'rank',      v_current_rank,
      'flagged',   v_flagged
    )
  );

  return v_audit_row;
end;
$$;

-- ===========================================================================
-- SECTION 4: RPC get_custody_chain
-- ===========================================================================

create or replace function public.get_custody_chain(
  p_resource_id uuid,
  p_limit       int default 50,
  p_before      timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id     uuid;
  v_inst_id       uuid;
  v_res_inst      uuid;
  v_is_admin      boolean;
  v_member_qual   boolean := false;
  v_segments      jsonb := '[]'::jsonb;
  r_booking       record;
  r_audit         record;
  v_checkout_ev   record;
  v_return_ev     record;
  v_inspection_ev record;
  v_photos        jsonb;
  v_incidents     jsonb;
  v_events        jsonb;
  v_dispute       jsonb;
  v_borrower_obj  jsonb;
  v_is_own        boolean;
  v_has_seen_prev boolean := false;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  select institution_id into v_res_inst
  from public.resources
  where id = p_resource_id;

  if not found then
    raise exception 'not_found';
  end if;

  v_inst_id := public.current_institution_id();
  if v_inst_id is null or v_inst_id <> v_res_inst then
    raise exception 'forbidden';
  end if;

  v_is_admin := public.is_institution_admin(v_res_inst);

  -- Member qualification: must have at least one booking on this resource in checked_out, returned, closed, disputed
  if not v_is_admin then
    select exists (
      select 1 from public.bookings
      where resource_id = p_resource_id
        and user_id = v_caller_id
        and status in ('checked_out', 'returned', 'closed', 'disputed')
    ) into v_member_qual;

    if not v_member_qual then
      raise exception 'forbidden';
    end if;
  end if;

  -- Build chronological segments (newest first)
  for r_booking in
    select b.*, p.full_name as borrower_name
    from public.bookings b
    left join public.profiles p on p.id = b.user_id
    where b.resource_id = p_resource_id
      and b.status in ('approved', 'checked_out', 'returned', 'closed', 'disputed')
      and (p_before is null or b.created_at < p_before)
    order by b.start_at desc
    limit coalesce(p_limit, 50)
  loop
    v_is_own := (r_booking.user_id = v_caller_id);

    -- Segment visibility logic:
    -- Admin sees all.
    -- Member sees own loans in full, and for each of their loans, only the single most recent earlier loan as redacted.
    if v_is_admin or v_is_own or (not v_has_seen_prev and r_booking.status in ('returned', 'closed', 'disputed')) then
      if not v_is_admin and not v_is_own then
        v_has_seen_prev := true;
      end if;

      -- Gather checkout and return events
      select * into v_checkout_ev from public.custody_events where booking_id = r_booking.id and phase = 'checkout' limit 1;
      select * into v_return_ev from public.custody_events where booking_id = r_booking.id and phase = 'checkin' limit 1;
      select * into v_inspection_ev from public.custody_events where booking_id = r_booking.id and phase = 'inspection' limit 1;

      -- Photos
      select coalesce(jsonb_agg(jsonb_build_object(
        'slot', cp.slot,
        'storage_path', cp.storage_path,
        'sha256', cp.sha256,
        'phase', cp.phase,
        'created_at', cp.created_at
      )), '[]'::jsonb) into v_photos
      from public.custody_photos cp
      where cp.booking_id = r_booking.id;

      -- If redacted (for member viewing prior borrower's return condition):
      if not v_is_admin and not v_is_own then
        v_segments := v_segments || jsonb_build_object(
          'booking_id', r_booking.id,
          'kind',       'loan',
          'redacted',   true,
          'borrower',   null,
          'checkout',   null,
          'return',     jsonb_build_object(
            'at',        v_return_ev.created_at,
            'condition', v_return_ev.condition,
            'rank',      public.condition_rank(v_return_ev.condition),
            'photos',    (
              select coalesce(jsonb_agg(jsonb_build_object(
                'slot', p.slot, 'storage_path', p.storage_path, 'sha256', p.sha256, 'created_at', p.created_at
              )), '[]'::jsonb)
              from public.custody_photos p
              where p.booking_id = r_booking.id and p.phase = 'checkin'
            )
          ),
          'inspection', null,
          'incidents',  '[]'::jsonb,
          'dispute',    null,
          'events',     '[]'::jsonb
        );
      else
        -- Full segment
        -- Incidents
        select coalesce(jsonb_agg(jsonb_build_object(
          'id', inc.id, 'severity', inc.severity, 'type', inc.type, 'description', inc.description, 'status', inc.status, 'created_at', inc.created_at
        )), '[]'::jsonb) into v_incidents
        from public.incidents inc
        where inc.booking_id = r_booking.id;

        -- Audit events for this booking
        select coalesce(jsonb_agg(jsonb_build_object(
          'action', al.action,
          'actor_name', coalesce(pr.full_name, 'System'),
          'role', pr.role,
          'time', al.created_at,
          'metadata', al.metadata
        ) order by al.created_at asc), '[]'::jsonb) into v_events
        from public.audit_log al
        left join public.profiles pr on pr.id = al.actor_id
        where al.action like 'custody.%'
          and al.entity_id = r_booking.id;

        v_segments := v_segments || jsonb_build_object(
          'booking_id', r_booking.id,
          'kind',       'loan',
          'redacted',   false,
          'borrower',   jsonb_build_object('id', r_booking.user_id, 'name', r_booking.borrower_name),
          'start_at',   r_booking.start_at,
          'end_at',     r_booking.end_at,
          'status',     r_booking.status,
          'checkout',   case when v_checkout_ev.id is not null then jsonb_build_object(
            'at', v_checkout_ev.created_at,
            'condition', v_checkout_ev.condition,
            'rank', public.condition_rank(v_checkout_ev.condition),
            'notes', v_checkout_ev.notes,
            'flagged', v_checkout_ev.flagged,
            'flag_reasons', v_checkout_ev.flag_reasons,
            'accessory_checks', v_checkout_ev.accessory_checks,
            'photos', (select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(v_photos) p where p->>'phase' = 'checkout')
          ) else null end,
          'return',     case when v_return_ev.id is not null then jsonb_build_object(
            'at', v_return_ev.created_at,
            'condition', v_return_ev.condition,
            'rank', public.condition_rank(v_return_ev.condition),
            'notes', v_return_ev.notes,
            'flagged', v_return_ev.flagged,
            'flag_reasons', v_return_ev.flag_reasons,
            'accessory_checks', v_return_ev.accessory_checks,
            'photos', (select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(v_photos) p where p->>'phase' = 'checkin')
          ) else null end,
          'inspection', case when v_inspection_ev.id is not null then jsonb_build_object(
            'at', v_inspection_ev.created_at,
            'condition', v_inspection_ev.condition,
            'rank', public.condition_rank(v_inspection_ev.condition),
            'notes', v_inspection_ev.notes
          ) else null end,
          'incidents',  v_incidents,
          'events',     v_events
        );
      end if;
    end if;
  end loop;

  -- If Admin, also merge spot audits
  if v_is_admin then
    for r_audit in
      select a.*, p.full_name as auditor_name
      from public.asset_audits a
      left join public.profiles p on p.id = a.performed_by
      where a.resource_id = p_resource_id
        and (p_before is null or a.created_at < p_before)
      order by a.created_at desc
      limit coalesce(p_limit, 50)
    loop
      v_segments := v_segments || jsonb_build_object(
        'audit_id',   r_audit.id,
        'kind',       'audit',
        'redacted',   false,
        'auditor',    jsonb_build_object('id', r_audit.performed_by, 'name', r_audit.auditor_name),
        'condition',  r_audit.condition,
        'rank',       public.condition_rank(r_audit.condition),
        'photos',     r_audit.photos,
        'accessory_checks', r_audit.accessory_checks,
        'notes',      r_audit.notes,
        'flagged',    r_audit.flagged,
        'created_at', r_audit.created_at
      );
    end loop;
  end if;

  return v_segments;
end;
$$;

-- ===========================================================================
-- SECTION 5: RPC search_custody_audit (Keyset Pagination)
-- ===========================================================================

create or replace function public.search_custody_audit(
  p_query         text        default null,
  p_resource_id   uuid        default null,
  p_user_id       uuid        default null,
  p_event_types   text[]      default null,
  p_from          timestamptz default null,
  p_to            timestamptz default null,
  p_flagged_only  boolean     default false,
  p_limit         int         default 50,
  p_before        bigint      default null
)
returns table (
  id              bigint,
  action          text,
  entity_type     text,
  entity_id       uuid,
  actor_id        uuid,
  actor_name      text,
  actor_role      text,
  resource_id     uuid,
  resource_name   text,
  asset_tag       text,
  booking_id      uuid,
  metadata        jsonb,
  created_at      timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id uuid;
  v_inst_id   uuid;
  v_q         text;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  v_inst_id := public.current_institution_id();
  if v_inst_id is null or not public.is_institution_admin(v_inst_id) then
    raise exception 'forbidden';
  end if;

  -- Escape wildcard chars for safe ILIKE search
  if p_query is not null and trim(p_query) <> '' then
    v_q := regexp_replace(trim(p_query), '([%_\\])', '\\\1', 'g');
  end if;

  return query
  select
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.actor_id,
    coalesce(pr.full_name, 'System') as actor_name,
    coalesce(pr.role::text, 'system') as actor_role,
    coalesce(res.id, (al.metadata->>'resource_id')::uuid) as resource_id,
    coalesce(res.name, al.metadata->>'resource_name', 'Asset') as resource_name,
    coalesce(res.asset_tag, al.metadata->>'asset_tag', '—') as asset_tag,
    case when al.entity_type = 'booking' then al.entity_id else (al.metadata->>'booking_id')::uuid end as booking_id,
    al.metadata,
    al.created_at
  from public.audit_log al
  left join public.profiles pr on pr.id = al.actor_id
  left join public.resources res on res.id = (
    case
      when al.entity_type = 'resource' then al.entity_id
      when al.metadata ? 'resource_id' then (al.metadata->>'resource_id')::uuid
      else null
    end
  )
  where al.institution_id = v_inst_id
    and al.action like 'custody.%'
    and (p_before is null or al.id < p_before)
    and (p_resource_id is null or al.entity_id = p_resource_id or (al.metadata->>'resource_id')::uuid = p_resource_id)
    and (p_user_id is null or al.actor_id = p_user_id)
    and (p_event_types is null or al.action = any(p_event_types))
    and (p_from is null or al.created_at >= p_from)
    and (p_to is null or al.created_at <= p_to)
    and (
      not p_flagged_only
      or (al.metadata->>'flagged')::boolean = true
      or al.action in ('custody.incident_reported', 'custody.dispute_opened')
    )
    and (
      v_q is null
      or coalesce(res.name, '') ilike ('%' || v_q || '%')
      or coalesce(res.asset_tag, '') ilike ('%' || v_q || '%')
      or coalesce(pr.full_name, '') ilike ('%' || v_q || '%')
    )
  order by al.id desc
  limit coalesce(p_limit, 50);
end;
$$;

-- ===========================================================================
-- SECTION 6: RPC get_my_custody_summary
-- ===========================================================================

create or replace function public.get_my_custody_summary()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id     uuid;
  v_inst_id       uuid;
  v_active_holdings jsonb;
  v_loan_history   jsonb;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  v_inst_id := public.current_institution_id();
  if v_inst_id is null then
    raise exception 'forbidden';
  end if;

  -- 1. Active holdings: checked_out bookings for caller
  select coalesce(jsonb_agg(jsonb_build_object(
    'booking_id',   b.id,
    'resource_id',  r.id,
    'name',         r.name,
    'asset_tag',    r.asset_tag,
    'category',     r.category,
    'start_at',     b.start_at,
    'end_at',       b.end_at,
    'status',       b.status,
    'qr_identifier', r.qr_identifier,
    'last_condition_rank', (
      select public.condition_rank(ce.condition)
      from public.custody_events ce
      where ce.booking_id = b.id and ce.phase = 'checkout'
      limit 1
    )
  )), '[]'::jsonb) into v_active_holdings
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  where b.user_id = v_caller_id
    and b.status = 'checked_out'
    and b.institution_id = v_inst_id;

  -- 2. Loan history: returned, closed, disputed bookings for caller
  select coalesce(jsonb_agg(jsonb_build_object(
    'booking_id',   b.id,
    'resource_id',  r.id,
    'name',         r.name,
    'asset_tag',    r.asset_tag,
    'category',     r.category,
    'start_at',     b.start_at,
    'end_at',       b.end_at,
    'status',       b.status,
    'last_condition_rank', (
      select public.condition_rank(ce.condition)
      from public.custody_events ce
      where ce.booking_id = b.id and ce.phase in ('checkin', 'inspection')
      order by ce.created_at desc
      limit 1
    )
  ) order by b.end_at desc), '[]'::jsonb) into v_loan_history
  from public.bookings b
  join public.resources r on r.id = b.resource_id
  where b.user_id = v_caller_id
    and b.status in ('returned', 'closed', 'disputed')
    and b.institution_id = v_inst_id;

  return jsonb_build_object(
    'active_holdings', v_active_holdings,
    'loan_history',   v_loan_history
  );
end;
$$;

-- ===========================================================================
-- SECTION 7: STORAGE POLICY & can_read_prior_return_photo
-- ===========================================================================

create or replace function public.can_read_prior_return_photo(p_object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_caller_id   uuid;
  v_parts       text[];
  v_target_bk   uuid;
  v_phase       text;
  v_photo_res   uuid;
  v_photo_start timestamptz;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    return false;
  end if;

  v_parts := string_to_array(p_object_name, '/');
  -- Expected path: <institution>/<booking>/<phase>/<slot>
  if array_length(v_parts, 1) < 4 then
    return false;
  end if;

  v_phase := v_parts[3];
  if v_phase <> 'checkin' then
    return false;
  end if;

  begin
    v_target_bk := v_parts[2]::uuid;
  exception when others then
    return false;
  end;

  -- Get resource and start time of the photo's booking
  select resource_id, start_at into v_photo_res, v_photo_start
  from public.bookings
  where id = v_target_bk;

  if not found then
    return false;
  end if;

  -- Caller must own a booking on the same resource in checked_out, returned, closed or disputed
  -- whose start_at is LATER than that photo booking's start_at
  return exists (
    select 1
    from public.bookings b
    where b.resource_id = v_photo_res
      and b.user_id = v_caller_id
      and b.status in ('checked_out', 'returned', 'closed', 'disputed')
      and b.start_at > v_photo_start
  );
end;
$$;

-- Recreate custody-photos select policy
drop policy if exists "custody_photos_select_participant" on storage.objects;
create policy "custody_photos_select_participant"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'custody-photos'
    and (
      public.is_booking_participant((string_to_array(name, '/'))[2]::uuid)
      or public.can_read_prior_return_photo(name)
    )
  );

-- ===========================================================================
-- SECTION 8: EXECUTION GRANTS & SCHEMA RELOAD
-- ===========================================================================

revoke execute on function public.resolve_asset_qr(text) from public, anon;
grant execute on function public.resolve_asset_qr(text) to authenticated;

revoke execute on function public.record_asset_audit(uuid, text, jsonb, public.condition_rating, jsonb, text) from public, anon;
grant execute on function public.record_asset_audit(uuid, text, jsonb, public.condition_rating, jsonb, text) to authenticated;

revoke execute on function public.get_custody_chain(uuid, int, timestamptz) from public, anon;
grant execute on function public.get_custody_chain(uuid, int, timestamptz) to authenticated;

revoke execute on function public.search_custody_audit(text, uuid, uuid, text[], timestamptz, timestamptz, boolean, int, bigint) from public, anon;
grant execute on function public.search_custody_audit(text, uuid, uuid, text[], timestamptz, timestamptz, boolean, int, bigint) to authenticated;

revoke execute on function public.get_my_custody_summary() from public, anon;
grant execute on function public.get_my_custody_summary() to authenticated;

notify pgrst, 'reload schema';
