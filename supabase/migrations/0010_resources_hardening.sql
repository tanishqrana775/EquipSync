-- =============================================================================
-- 0010_resources_hardening.sql – CampusShare / EquipSync
-- Resource Status Hardening, Immutable Asset Tags, Category Registry & Life-Cycle RPCs
-- =============================================================================

-- ===========================================================================
-- SECTION 1: RETIRED STATUS AVAILABILITY HARDENING
-- ===========================================================================

-- 1. Ensure all currently retired resources have is_available = false
update public.resources
set is_available = false
where status = 'retired' and is_available = true;

-- 2. Add constraint resources_retired_not_available (NOT VALID then VALIDATE)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'resources_retired_not_available'
      and conrelid = 'public.resources'::regclass
  ) then
    alter table public.resources
      add constraint resources_retired_not_available
      check (status <> 'retired' or is_available = false) not valid;
  end if;
end $$;

alter table public.resources
  validate constraint resources_retired_not_available;

-- 3. Trigger preventing is_available = true while status = 'retired'
create or replace function public.trg_check_retired_availability()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.status = 'retired' and NEW.is_available = true then
    raise exception 'resource_retired';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_resources_check_retired_availability on public.resources;
create trigger trg_resources_check_retired_availability
  before update on public.resources
  for each row
  execute function public.trg_check_retired_availability();

-- ===========================================================================
-- SECTION 2: ASSET TAG UNIQUENESS & IMMUTABILITY
-- ===========================================================================

-- 1. Pre-check for duplicate asset tags per institution (case-insensitive)
do $$
declare
  dup_list text;
begin
  with duplicates as (
    select institution_id, lower(trim(asset_tag)) as tag, count(*) as cnt
    from public.resources
    where asset_tag is not null and trim(asset_tag) <> ''
    group by institution_id, lower(trim(asset_tag))
    having count(*) > 1
  )
  select string_agg(format('inst: %s, tag: %s (count: %s)', institution_id, tag, cnt), '; ')
  into dup_list
  from duplicates;

  if dup_list is not null then
    raise exception 'Duplicate asset tags found per institution: %', dup_list;
  end if;
end $$;

-- 2. Unique index on (institution_id, lower(asset_tag))
create unique index if not exists idx_resources_institution_asset_tag_lower_unique
  on public.resources (institution_id, lower(trim(asset_tag)))
  where asset_tag is not null and trim(asset_tag) <> '';

-- 3. Trigger for asset_tag generation (BEFORE INSERT) and immutability (BEFORE UPDATE)
create or replace function public.trg_resources_asset_tag_handler()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  tag_suffix text;
  generated_tag text;
  i int;
  attempts int := 0;
begin
  if TG_OP = 'INSERT' then
    if NEW.asset_tag is null or trim(NEW.asset_tag) = '' then
      loop
        tag_suffix := '';
        for i in 1..6 loop
          tag_suffix := tag_suffix || substr(alphabet, 1 + floor(random() * 32)::int, 1);
        end loop;
        generated_tag := 'EQP-' || tag_suffix;

        if not exists (
          select 1 from public.resources
          where institution_id = NEW.institution_id
            and lower(trim(asset_tag)) = lower(generated_tag)
        ) then
          NEW.asset_tag := generated_tag;
          exit;
        end if;

        attempts := attempts + 1;
        if attempts >= 50 then
          raise exception 'asset_tag_generation_failed';
        end if;
      end loop;
    end if;
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if OLD.asset_tag is not null and trim(OLD.asset_tag) <> '' and NEW.asset_tag is distinct from OLD.asset_tag then
      raise exception 'asset_tag_immutable';
    end if;
    return NEW;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_resources_asset_tag_insert on public.resources;
create trigger trg_resources_asset_tag_insert
  before insert on public.resources
  for each row
  execute function public.trg_resources_asset_tag_handler();

drop trigger if exists trg_resources_asset_tag_update on public.resources;
create trigger trg_resources_asset_tag_update
  before update on public.resources
  for each row
  execute function public.trg_resources_asset_tag_handler();

-- ===========================================================================
-- SECTION 3: RESOURCE CATEGORIES TABLE & RLS
-- ===========================================================================

create table if not exists public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions(id) on delete cascade,
  name text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint resource_categories_name_length check (
    length(trim(name)) between 1 and 40
    and trim(name) !~ '[\x00-\x1F\x7F]'
  )
);

create unique index if not exists idx_resource_categories_institution_lower_name
  on public.resource_categories (institution_id, lower(trim(name)));

create index if not exists idx_resource_categories_institution_id
  on public.resource_categories (institution_id);

alter table public.resource_categories enable row level security;

-- Select: members and admins of that institution
drop policy if exists "resource_categories_select" on public.resource_categories;
create policy "resource_categories_select"
  on public.resource_categories for select
  to authenticated
  using (
    institution_id = public.current_institution_id()
    or public.is_institution_admin(institution_id)
  );

-- Insert: institution admin only
drop policy if exists "resource_categories_insert_admin" on public.resource_categories;
create policy "resource_categories_insert_admin"
  on public.resource_categories for insert
  to authenticated
  with check (public.is_institution_admin(institution_id));

-- Delete: institution admin only
drop policy if exists "resource_categories_delete_admin" on public.resource_categories;
create policy "resource_categories_delete_admin"
  on public.resource_categories for delete
  to authenticated
  using (public.is_institution_admin(institution_id));

-- No update on resource_categories
revoke update on public.resource_categories from public, anon, authenticated;

-- ===========================================================================
-- SECTION 4: RPC ensure_category
-- ===========================================================================

create or replace function public.ensure_category(p_name text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id    uuid;
  v_inst_id      uuid;
  v_clean_name   text;
  v_existing_name text;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  v_inst_id := public.current_institution_id();
  if v_inst_id is null or not public.is_institution_admin(v_inst_id) then
    raise exception 'forbidden';
  end if;

  -- Trim and collapse consecutive whitespaces
  v_clean_name := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');

  if length(v_clean_name) < 1 or length(v_clean_name) > 40 or v_clean_name ~ '[\x00-\x1F\x7F]' then
    raise exception 'invalid_category';
  end if;

  -- Match case-insensitively against presets first
  if lower(v_clean_name) = 'laptops' then
    return 'Laptops';
  elsif lower(v_clean_name) = 'dslr cameras' then
    return 'DSLR Cameras';
  elsif lower(v_clean_name) = 'lab equipment' then
    return 'Lab Equipment';
  elsif lower(v_clean_name) = 'seminar halls' then
    return 'Seminar Halls';
  elsif lower(v_clean_name) = 'projectors' then
    return 'Projectors';
  elsif lower(v_clean_name) = 'classrooms' then
    return 'Classrooms';
  elsif lower(v_clean_name) = 'sports equipment' then
    return 'Sports Equipment';
  elsif lower(v_clean_name) = 'academic books' then
    return 'Academic Books';
  end if;

  -- Match against existing custom categories for this institution
  select name into v_existing_name
  from public.resource_categories
  where institution_id = v_inst_id
    and lower(trim(name)) = lower(v_clean_name)
  limit 1;

  if v_existing_name is not null then
    return v_existing_name;
  end if;

  -- Insert new custom category
  insert into public.resource_categories (institution_id, name, created_by)
  values (v_inst_id, v_clean_name, v_caller_id)
  returning name into v_existing_name;

  return v_existing_name;
end;
$$;

-- ===========================================================================
-- SECTION 5: RPC retire_resource
-- ===========================================================================

create or replace function public.retire_resource(
  p_resource_id uuid,
  p_reason      text
)
returns public.resources
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id   uuid;
  v_resource    public.resources%rowtype;
  v_booking     record;
  v_waitlist    record;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if not public.is_institution_admin(v_resource.institution_id) then
    raise exception 'forbidden';
  end if;

  -- Block if any active custody lifecycle bookings exist
  if exists (
    select 1
    from public.bookings
    where resource_id = p_resource_id
      and status in ('checked_out', 'returned', 'disputed')
  ) then
    raise exception 'resource_in_use';
  end if;

  -- Update resource status to retired and is_available to false
  update public.resources
  set status = 'retired',
      is_available = false,
      updated_at = now()
  where id = p_resource_id
  returning * into v_resource;

  -- Cancel pending and approved bookings that have not started
  for v_booking in
    select id, user_id
    from public.bookings
    where resource_id = p_resource_id
      and status in ('pending', 'approved')
      and start_at > now()
  loop
    update public.bookings
    set status = 'cancelled',
        decided_by = v_caller_id,
        decided_at = now(),
        decision_note = 'Resource retired: ' || coalesce(p_reason, 'No reason provided')
    where id = v_booking.id;

    perform public.notify(
      v_booking.user_id,
      'booking_cancelled',
      'Reservation Cancelled',
      'Your reservation was cancelled because the equipment has been retired.',
      '/app/bookings/' || v_booking.id
    );
  end loop;

  -- Cancel waitlist entries
  for v_waitlist in
    select id, user_id
    from public.waitlist_entries
    where resource_id = p_resource_id
      and status in ('waiting', 'offered')
  loop
    update public.waitlist_entries
    set status = 'cancelled'
    where id = v_waitlist.id;

    perform public.notify(
      v_waitlist.user_id,
      'waitlist_cancelled',
      'Waitlist Cancelled',
      'The equipment you were waitlisted for has been retired.',
      '/app/discover'
    );
  end loop;

  -- Expire open released slots
  update public.released_slots
  set status = 'expired'
  where resource_id = p_resource_id
    and status = 'open';

  -- Record audit event
  insert into public.audit_log (
    institution_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_resource.institution_id,
    v_caller_id,
    'resource.retired',
    'resource',
    p_resource_id,
    jsonb_build_object(
      'reason', p_reason,
      'previous_status', v_resource.status
    )
  );

  return v_resource;
end;
$$;

-- ===========================================================================
-- SECTION 6: RPC reactivate_resource
-- ===========================================================================

create or replace function public.reactivate_resource(
  p_resource_id uuid
)
returns public.resources
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_caller_id   uuid;
  v_resource    public.resources%rowtype;
begin
  v_caller_id := (select auth.uid());
  if v_caller_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_resource
  from public.resources
  where id = p_resource_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;

  if not public.is_institution_admin(v_resource.institution_id) then
    raise exception 'forbidden';
  end if;

  if v_resource.status <> 'retired' then
    raise exception 'invalid_state';
  end if;

  -- Set status 'active' and leave is_available false
  update public.resources
  set status = 'active',
      is_available = false,
      updated_at = now()
  where id = p_resource_id
  returning * into v_resource;

  -- Record audit event
  insert into public.audit_log (
    institution_id, actor_id, action, entity_type, entity_id, metadata
  ) values (
    v_resource.institution_id,
    v_caller_id,
    'resource.reactivated',
    'resource',
    p_resource_id,
    jsonb_build_object(
      'previous_status', 'retired'
    )
  );

  return v_resource;
end;
$$;

-- ===========================================================================
-- SECTION 7: GRANTS & PERMISSIONS
-- ===========================================================================

revoke execute on function public.ensure_category(text) from public, anon;
grant execute on function public.ensure_category(text) to authenticated;

revoke execute on function public.retire_resource(uuid, text) from public, anon;
grant execute on function public.retire_resource(uuid, text) to authenticated;

revoke execute on function public.reactivate_resource(uuid) from public, anon;
grant execute on function public.reactivate_resource(uuid) to authenticated;

notify pgrst, 'reload schema';