-- =============================================================================
-- 0001_schema.sql  –  CampusShare  –  Postgres 15 / Supabase
-- Run once on an empty database; subsequent migrations follow.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists btree_gist  with schema extensions;
create extension if not exists pgcrypto    with schema extensions;

-- ---------------------------------------------------------------------------
-- Utility: updated_at trigger function
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.user_role           as enum ('institution_admin', 'member');
create type public.user_type           as enum ('student', 'staff', 'external');
create type public.verification_status as enum ('pending', 'verified', 'rejected');
create type public.resource_kind       as enum ('equipment', 'space', 'lab');
create type public.booking_status      as enum (
  'pending', 'approved', 'rejected', 'cancelled',
  'released', 'checked_out', 'returned', 'closed', 'disputed'
);
create type public.custody_phase       as enum ('checkout', 'checkin', 'inspection');
create type public.condition_rating    as enum ('good', 'minor_wear', 'damaged', 'missing_parts');
create type public.waitlist_status     as enum ('waiting', 'offered', 'claimed', 'expired', 'cancelled');
create type public.slot_status         as enum ('open', 'claimed', 'expired');
create type public.incident_severity   as enum ('low', 'medium', 'high');
create type public.incident_status     as enum ('open', 'resolved');

-- ---------------------------------------------------------------------------
-- institutions
-- ---------------------------------------------------------------------------
create table public.institutions (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null,
  email_domain text,
  address     text,
  created_by  uuid references auth.users on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_institutions_updated_at
  before update on public.institutions
  for each row execute function public.set_updated_at();

create index idx_institutions_created_by on public.institutions(created_by);

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                  uuid primary key references auth.users on delete cascade,
  institution_id      uuid references public.institutions on delete set null,
  full_name           text not null,
  role                public.user_role        not null default 'member',
  user_type           public.user_type,
  verification_status public.verification_status not null default 'pending',
  avatar_url          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index idx_profiles_institution_id      on public.profiles(institution_id);
create index idx_profiles_verification_status on public.profiles(verification_status);
create index idx_profiles_role                on public.profiles(role);

-- ---------------------------------------------------------------------------
-- qualifications
-- ---------------------------------------------------------------------------
create table public.qualifications (
  id             uuid primary key default gen_random_uuid(),
  institution_id uuid not null references public.institutions on delete cascade,
  name           text not null,
  created_at     timestamptz not null default now(),
  unique (institution_id, name)
);

create index idx_qualifications_institution_id on public.qualifications(institution_id);

-- ---------------------------------------------------------------------------
-- user_qualifications
-- ---------------------------------------------------------------------------
create table public.user_qualifications (
  user_id          uuid not null references public.profiles on delete cascade,
  qualification_id uuid not null references public.qualifications on delete cascade,
  status           public.verification_status not null default 'pending',
  evidence_path    text,
  verified_by      uuid references public.profiles on delete set null,
  verified_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, qualification_id)
);

create trigger trg_user_qualifications_updated_at
  before update on public.user_qualifications
  for each row execute function public.set_updated_at();

create index idx_user_qualifications_qualification_id on public.user_qualifications(qualification_id);
create index idx_user_qualifications_verified_by      on public.user_qualifications(verified_by);
create index idx_user_qualifications_status           on public.user_qualifications(status);

-- ---------------------------------------------------------------------------
-- resources
-- ---------------------------------------------------------------------------
create table public.resources (
  id                    uuid primary key default gen_random_uuid(),
  institution_id        uuid not null references public.institutions on delete cascade,
  name                  text not null,
  kind                  public.resource_kind not null,
  category              text,
  description           text,
  location              text,
  asset_tag             text,
  image_path            text,
  is_available          boolean not null default true,
  status                text not null default 'active'
                          check (status in ('active', 'maintenance', 'retired')),
  required_photo_slots  text[] not null default '{front,back,left,right}',
  created_by            uuid references public.profiles on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger trg_resources_updated_at
  before update on public.resources
  for each row execute function public.set_updated_at();

create index idx_resources_institution_id on public.resources(institution_id);
create index idx_resources_is_available   on public.resources(is_available);
create index idx_resources_status         on public.resources(status);
create index idx_resources_created_by     on public.resources(created_by);

-- ---------------------------------------------------------------------------
-- eligibility_rules  (1-to-1 with resources)
-- ---------------------------------------------------------------------------
create table public.eligibility_rules (
  resource_id              uuid primary key references public.resources on delete cascade,
  requires_approval        boolean not null default true,
  requires_supervision     boolean not null default false,
  allowed_user_types       public.user_type[] not null default array['student','staff','external']::public.user_type[],
  max_duration_minutes     int,
  min_lead_time_minutes    int not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger trg_eligibility_rules_updated_at
  before update on public.eligibility_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- resource_required_qualifications
-- ---------------------------------------------------------------------------
create table public.resource_required_qualifications (
  resource_id      uuid not null references public.resources on delete cascade,
  qualification_id uuid not null references public.qualifications on delete cascade,
  primary key (resource_id, qualification_id)
);

create index idx_rrq_qualification_id on public.resource_required_qualifications(qualification_id);

-- ---------------------------------------------------------------------------
-- resource_accessories
-- ---------------------------------------------------------------------------
create table public.resource_accessories (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources on delete cascade,
  name        text not null,
  required    boolean not null default true,
  created_at  timestamptz not null default now()
);

create index idx_resource_accessories_resource_id on public.resource_accessories(resource_id);

-- ---------------------------------------------------------------------------
-- resource_availability_windows
-- ---------------------------------------------------------------------------
create table public.resource_availability_windows (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6),
  start_time  time not null,
  end_time    time not null,
  created_at  timestamptz not null default now(),
  check (end_time > start_time)
);

create index idx_raw_resource_id on public.resource_availability_windows(resource_id);
create index idx_raw_weekday      on public.resource_availability_windows(weekday);

-- ---------------------------------------------------------------------------
-- resource_evidence
-- ---------------------------------------------------------------------------
create table public.resource_evidence (
  id           uuid primary key default gen_random_uuid(),
  resource_id  uuid not null references public.resources on delete cascade,
  storage_path text not null,
  note         text,
  uploaded_by  uuid references public.profiles on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_resource_evidence_resource_id  on public.resource_evidence(resource_id);
create index idx_resource_evidence_uploaded_by  on public.resource_evidence(uploaded_by);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  resource_id   uuid not null references public.resources on delete restrict,
  user_id       uuid not null references public.profiles on delete restrict,
  institution_id uuid not null references public.institutions on delete restrict,
  start_at      timestamptz not null,
  end_at        timestamptz not null,
  purpose       text,
  supervisor_name text,
  status        public.booking_status not null default 'pending',
  decided_by    uuid references public.profiles on delete set null,
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (end_at > start_at),
  -- Prevent overlapping approved/checked_out bookings for the same resource
  exclude using gist (
    resource_id  with =,
    tstzrange(start_at, end_at, '[)') with &&
  ) where (status in ('approved', 'checked_out'))
);

create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

create index idx_bookings_resource_id    on public.bookings(resource_id);
create index idx_bookings_user_id        on public.bookings(user_id);
create index idx_bookings_institution_id on public.bookings(institution_id);
create index idx_bookings_status         on public.bookings(status);
create index idx_bookings_start_at       on public.bookings(start_at);
create index idx_bookings_decided_by     on public.bookings(decided_by);

-- ---------------------------------------------------------------------------
-- waitlist_entries
-- ---------------------------------------------------------------------------
create table public.waitlist_entries (
  id            uuid primary key default gen_random_uuid(),
  resource_id   uuid not null references public.resources on delete cascade,
  user_id       uuid not null references public.profiles on delete cascade,
  desired_start timestamptz not null,
  desired_end   timestamptz not null,
  status        public.waitlist_status not null default 'waiting',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Partial unique index enforces the active entry rule
create unique index waitlist_unique_active_entry_idx
on public.waitlist_entries (resource_id, user_id, desired_start)
where (status in ('waiting', 'offered'));

create trigger trg_waitlist_entries_updated_at
  before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

create index idx_waitlist_entries_resource_id on public.waitlist_entries(resource_id);
create index idx_waitlist_entries_user_id     on public.waitlist_entries(user_id);
create index idx_waitlist_entries_status      on public.waitlist_entries(status);

-- ---------------------------------------------------------------------------
-- released_slots
-- ---------------------------------------------------------------------------
create table public.released_slots (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings on delete cascade,
  resource_id      uuid not null references public.resources on delete cascade,
  institution_id   uuid not null references public.institutions on delete cascade,
  start_at         timestamptz not null,
  end_at           timestamptz not null,
  released_by      uuid not null references public.profiles on delete restrict,
  status           public.slot_status not null default 'open',
  claimed_by       uuid references public.profiles on delete set null,
  claimed_booking_id uuid references public.bookings on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_released_slots_updated_at
  before update on public.released_slots
  for each row execute function public.set_updated_at();

create index idx_released_slots_booking_id         on public.released_slots(booking_id);
create index idx_released_slots_resource_id        on public.released_slots(resource_id);
create index idx_released_slots_institution_id     on public.released_slots(institution_id);
create index idx_released_slots_status             on public.released_slots(status);
create index idx_released_slots_claimed_by         on public.released_slots(claimed_by);
create index idx_released_slots_claimed_booking_id on public.released_slots(claimed_booking_id);

-- ---------------------------------------------------------------------------
-- custody_events
-- ---------------------------------------------------------------------------
create table public.custody_events (
  id               uuid primary key default gen_random_uuid(),
  booking_id       uuid not null references public.bookings on delete cascade,
  phase            public.custody_phase not null,
  actor_id         uuid not null references public.profiles on delete restrict,
  condition        public.condition_rating not null,
  notes            text,
  accessory_checks jsonb not null default '[]'::jsonb,
  created_at       timestamptz not null default now()
);

create index idx_custody_events_booking_id on public.custody_events(booking_id);
create index idx_custody_events_actor_id   on public.custody_events(actor_id);
create index idx_custody_events_phase      on public.custody_events(phase);

-- ---------------------------------------------------------------------------
-- custody_photos
-- ---------------------------------------------------------------------------
create table public.custody_photos (
  id                  uuid primary key default gen_random_uuid(),
  booking_id          uuid not null references public.bookings on delete cascade,
  phase               public.custody_phase not null,
  slot                text not null,
  storage_path        text not null unique,
  taken_by            uuid not null references public.profiles on delete restrict,
  sha256              text not null,
  client_captured_at  timestamptz not null,
  created_at          timestamptz not null default now(),
  unique (booking_id, phase, slot)
);

create index idx_custody_photos_booking_id on public.custody_photos(booking_id);
create index idx_custody_photos_taken_by   on public.custody_photos(taken_by);
create index idx_custody_photos_phase      on public.custody_photos(phase);

-- ---------------------------------------------------------------------------
-- incidents
-- ---------------------------------------------------------------------------
create table public.incidents (
  id            uuid primary key default gen_random_uuid(),
  booking_id    uuid not null references public.bookings on delete cascade,
  resource_id   uuid not null references public.resources on delete cascade,
  institution_id uuid not null references public.institutions on delete cascade,
  reported_by   uuid not null references public.profiles on delete restrict,
  severity      public.incident_severity not null,
  type          text not null check (type in ('damage', 'missing_accessory', 'other')),
  description   text not null,
  status        public.incident_status not null default 'open',
  ai_summary    text,
  resolved_by   uuid references public.profiles on delete set null,
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger trg_incidents_updated_at
  before update on public.incidents
  for each row execute function public.set_updated_at();

create index idx_incidents_booking_id    on public.incidents(booking_id);
create index idx_incidents_resource_id   on public.incidents(resource_id);
create index idx_incidents_institution_id on public.incidents(institution_id);
create index idx_incidents_reported_by   on public.incidents(reported_by);
create index idx_incidents_status        on public.incidents(status);
create index idx_incidents_resolved_by   on public.incidents(resolved_by);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index idx_notifications_user_id  on public.notifications(user_id);
create index idx_notifications_read_at  on public.notifications(read_at);

-- ---------------------------------------------------------------------------
-- audit_log  (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_log (
  id          bigint generated always as identity primary key,
  institution_id uuid references public.institutions on delete set null,
  actor_id    uuid references public.profiles on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index idx_audit_log_institution_id on public.audit_log(institution_id);
create index idx_audit_log_actor_id       on public.audit_log(actor_id);
create index idx_audit_log_entity_id      on public.audit_log(entity_id);
create index idx_audit_log_created_at     on public.audit_log(created_at);
