-- =============================================================================
-- 0003_rls_storage.sql  –  CampusShare  –  RLS, Storage, Realtime, Grants
-- Depends on: 0001_schema.sql, 0002_functions.sql
-- =============================================================================

-- ===========================================================================
-- SECTION 1: ENABLE RLS ON ALL TABLES
-- ===========================================================================

alter table public.institutions                    enable row level security;
alter table public.profiles                        enable row level security;
alter table public.qualifications                  enable row level security;
alter table public.user_qualifications             enable row level security;
alter table public.resources                       enable row level security;
alter table public.eligibility_rules               enable row level security;
alter table public.resource_required_qualifications enable row level security;
alter table public.resource_accessories            enable row level security;
alter table public.resource_availability_windows   enable row level security;
alter table public.resource_evidence               enable row level security;
alter table public.bookings                        enable row level security;
alter table public.waitlist_entries                enable row level security;
alter table public.released_slots                  enable row level security;
alter table public.custody_events                  enable row level security;
alter table public.custody_photos                  enable row level security;
alter table public.incidents                       enable row level security;
alter table public.notifications                   enable row level security;
alter table public.audit_log                       enable row level security;

-- ===========================================================================
-- SECTION 2: REVOKE DIRECT WRITE PRIVILEGES FOR PROTECTED TABLES
-- ===========================================================================

-- bookings: no client writes (only through RPCs)
revoke insert, update, delete on public.bookings             from anon, authenticated;
revoke insert, update, delete on public.custody_events       from anon, authenticated;
revoke insert, update, delete on public.custody_photos       from anon, authenticated;
revoke insert, update, delete on public.incidents            from anon, authenticated;
revoke insert, update, delete on public.notifications        from anon, authenticated;
revoke insert, update, delete on public.waitlist_entries     from anon, authenticated;
revoke insert, update, delete on public.released_slots       from anon, authenticated;
-- audit_log: append-only, no client writes at all
revoke insert, update, delete on public.audit_log            from anon, authenticated, service_role;

-- Grant notifications read + read_at update back selectively (policies do the row restriction)
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- ===========================================================================
-- SECTION 3: INSTITUTIONS
-- ===========================================================================

create policy "institutions_select_authenticated"
  on public.institutions for select
  to authenticated
  using (true);

create policy "institutions_update_admin"
  on public.institutions for update
  to authenticated
  using  (public.is_institution_admin(id))
  with check (public.is_institution_admin(id));

-- ===========================================================================
-- SECTION 4: PROFILES
-- ===========================================================================

-- Select: own row, or institution admin of same institution
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "profiles_select_admin"
  on public.profiles for select
  to authenticated
  using (public.is_institution_admin(institution_id));

-- Restrict UPDATE columns: revoke generic update, grant only specific columns
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using  (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- No insert/delete policies: handle_new_user trigger inserts; no row deletion allowed from client.

-- ===========================================================================
-- SECTION 5: QUALIFICATIONS
-- ===========================================================================

create policy "qualifications_select_authenticated"
  on public.qualifications for select
  to authenticated
  using (true);

create policy "qualifications_insert_admin"
  on public.qualifications for insert
  to authenticated
  with check (public.is_institution_admin(institution_id));

create policy "qualifications_update_admin"
  on public.qualifications for update
  to authenticated
  using  (public.is_institution_admin(institution_id))
  with check (public.is_institution_admin(institution_id));

create policy "qualifications_delete_admin"
  on public.qualifications for delete
  to authenticated
  using (public.is_institution_admin(institution_id));

-- ===========================================================================
-- SECTION 6: USER_QUALIFICATIONS
-- ===========================================================================

-- Select: own row, or admin of same institution
create policy "user_qualifications_select_own"
  on public.user_qualifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "user_qualifications_select_admin"
  on public.user_qualifications for select
  to authenticated
  using (
    exists (
      select 1 from public.qualifications q
      where  q.id = qualification_id
        and  public.is_institution_admin(q.institution_id)
    )
  );

-- Insert: own row only; status forced to 'pending' via check
create policy "user_qualifications_insert_own"
  on public.user_qualifications for insert
  to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
  );

-- No update from client (verify_qualification RPC handles it)

-- ===========================================================================
-- SECTION 7: RESOURCES
-- ===========================================================================

create policy "resources_select_authenticated"
  on public.resources for select
  to authenticated
  using (true);

create policy "resources_insert_admin"
  on public.resources for insert
  to authenticated
  with check (public.is_institution_admin(institution_id));

create policy "resources_update_admin"
  on public.resources for update
  to authenticated
  using  (public.is_institution_admin(institution_id))
  with check (public.is_institution_admin(institution_id));

create policy "resources_delete_admin"
  on public.resources for delete
  to authenticated
  using (public.is_institution_admin(institution_id));

-- ===========================================================================
-- SECTION 8: ELIGIBILITY_RULES
-- ===========================================================================

create policy "eligibility_rules_select_authenticated"
  on public.eligibility_rules for select
  to authenticated
  using (true);

create policy "eligibility_rules_insert_admin"
  on public.eligibility_rules for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "eligibility_rules_update_admin"
  on public.eligibility_rules for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  )
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "eligibility_rules_delete_admin"
  on public.eligibility_rules for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

-- ===========================================================================
-- SECTION 9: RESOURCE_REQUIRED_QUALIFICATIONS
-- ===========================================================================

create policy "rrq_select_authenticated"
  on public.resource_required_qualifications for select
  to authenticated
  using (true);

create policy "rrq_insert_admin"
  on public.resource_required_qualifications for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "rrq_update_admin"
  on public.resource_required_qualifications for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "rrq_delete_admin"
  on public.resource_required_qualifications for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

-- ===========================================================================
-- SECTION 10: RESOURCE_ACCESSORIES
-- ===========================================================================

create policy "resource_accessories_select_authenticated"
  on public.resource_accessories for select
  to authenticated
  using (true);

create policy "resource_accessories_insert_admin"
  on public.resource_accessories for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "resource_accessories_update_admin"
  on public.resource_accessories for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "resource_accessories_delete_admin"
  on public.resource_accessories for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

-- ===========================================================================
-- SECTION 11: RESOURCE_AVAILABILITY_WINDOWS
-- ===========================================================================

create policy "raw_select_authenticated"
  on public.resource_availability_windows for select
  to authenticated
  using (true);

create policy "raw_insert_admin"
  on public.resource_availability_windows for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "raw_update_admin"
  on public.resource_availability_windows for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "raw_delete_admin"
  on public.resource_availability_windows for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

-- ===========================================================================
-- SECTION 12: RESOURCE_EVIDENCE
-- ===========================================================================

create policy "resource_evidence_select_admin"
  on public.resource_evidence for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "resource_evidence_insert_admin"
  on public.resource_evidence for insert
  to authenticated
  with check (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "resource_evidence_update_admin"
  on public.resource_evidence for update
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

create policy "resource_evidence_delete_admin"
  on public.resource_evidence for delete
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

-- ===========================================================================
-- SECTION 13: BOOKINGS (SELECT only via RLS; writes through RPCs)
-- ===========================================================================

create policy "bookings_select_own"
  on public.bookings for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "bookings_select_admin"
  on public.bookings for select
  to authenticated
  using (public.is_institution_admin(institution_id));

-- ===========================================================================
-- SECTION 14: WAITLIST_ENTRIES
-- ===========================================================================

create policy "waitlist_entries_select_own"
  on public.waitlist_entries for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "waitlist_entries_select_admin"
  on public.waitlist_entries for select
  to authenticated
  using (
    exists (
      select 1 from public.resources r
      where r.id = resource_id and public.is_institution_admin(r.institution_id)
    )
  );

-- ===========================================================================
-- SECTION 15: RELEASED_SLOTS
-- ===========================================================================

-- Own released slots (as releaser or claimer)
create policy "released_slots_select_own"
  on public.released_slots for select
  to authenticated
  using (
    released_by = (select auth.uid())
    or claimed_by = (select auth.uid())
  );

-- Admin of the institution
create policy "released_slots_select_admin"
  on public.released_slots for select
  to authenticated
  using (public.is_institution_admin(institution_id));

-- Verified members can see open slots in their institution
create policy "released_slots_select_open_member"
  on public.released_slots for select
  to authenticated
  using (
    status = 'open'
    and public.is_verified_member()
    and institution_id = public.current_institution_id()
  );

-- ===========================================================================
-- SECTION 16: CUSTODY_EVENTS
-- ===========================================================================

create policy "custody_events_select_participant"
  on public.custody_events for select
  to authenticated
  using (public.is_booking_participant(booking_id));

-- ===========================================================================
-- SECTION 17: CUSTODY_PHOTOS
-- ===========================================================================

create policy "custody_photos_select_participant"
  on public.custody_photos for select
  to authenticated
  using (public.is_booking_participant(booking_id));

-- NO insert, update, delete policies (all writes through check_out/check_in RPCs)

-- ===========================================================================
-- SECTION 18: INCIDENTS
-- ===========================================================================

create policy "incidents_select_participant"
  on public.incidents for select
  to authenticated
  using (public.is_booking_participant(booking_id));

create policy "incidents_select_admin"
  on public.incidents for select
  to authenticated
  using (public.is_institution_admin(institution_id));

-- ===========================================================================
-- SECTION 19: NOTIFICATIONS
-- ===========================================================================

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "notifications_update_read_at"
  on public.notifications for update
  to authenticated
  using  (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ===========================================================================
-- SECTION 20: AUDIT_LOG
-- ===========================================================================

create policy "audit_log_select_admin"
  on public.audit_log for select
  to authenticated
  using (public.is_institution_admin(institution_id));

-- No insert/update/delete policies; all writes go through security-definer trigger.
-- service_role write revoked above.

-- ===========================================================================
-- SECTION 21: STORAGE BUCKETS
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'resource-images',
    'resource-images',
    true,
    5242880,  -- 5 MB
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'custody-photos',
    'custody-photos',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'resource-evidence',
    'resource-evidence',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  ),
  (
    'qualification-docs',
    'qualification-docs',
    false,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
  )
on conflict (id) do nothing;

-- ===========================================================================
-- SECTION 22: STORAGE POLICIES
-- Path conventions:
--   resource-images:    <institution_id>/<resource_id>/<filename>
--   custody-photos:     <institution_id>/<booking_id>/<phase>/<slot>.jpg
--   resource-evidence:  <institution_id>/<resource_id>/<filename>
--   qualification-docs: <institution_id>/<user_id>/<filename>
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- resource-images
-- ---------------------------------------------------------------------------

create policy "resource_images_public_select"
  on storage.objects for select
  using (bucket_id = 'resource-images');

create policy "resource_images_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resource-images'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

create policy "resource_images_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resource-images'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

create policy "resource_images_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resource-images'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- custody-photos  (immutable evidence: INSERT + SELECT only, NO update/delete)
-- Path: <institution_id>/<booking_id>/<phase>/<slot>.jpg
-- ---------------------------------------------------------------------------

create policy "custody_photos_insert_owner"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'custody-photos'
    and exists (
      select 1
      from   public.bookings b
      where  b.id             = (string_to_array(name, '/'))[2]::uuid
        and  b.user_id        = (select auth.uid())
        and  b.status         in ('approved', 'checked_out')
        and  b.institution_id = (string_to_array(name, '/'))[1]::uuid
    )
  );

create policy "custody_photos_select_participant"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'custody-photos'
    and public.is_booking_participant((string_to_array(name, '/'))[2]::uuid)
  );

-- NO update or delete policy for custody-photos (immutable evidence)

-- ---------------------------------------------------------------------------
-- resource-evidence
-- ---------------------------------------------------------------------------

create policy "resource_evidence_admin_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resource-evidence'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

create policy "resource_evidence_admin_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resource-evidence'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

create policy "resource_evidence_admin_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resource-evidence'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

create policy "resource_evidence_admin_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resource-evidence'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

-- ---------------------------------------------------------------------------
-- qualification-docs
-- Path: <institution_id>/<user_id>/<filename>
-- ---------------------------------------------------------------------------

create policy "qualification_docs_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'qualification-docs'
    and (string_to_array(name, '/'))[2]::uuid = (select auth.uid())
  );

create policy "qualification_docs_owner_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'qualification-docs'
    and (string_to_array(name, '/'))[2]::uuid = (select auth.uid())
  );

create policy "qualification_docs_admin_select"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'qualification-docs'
    and public.is_institution_admin((string_to_array(name, '/'))[1]::uuid)
  );

-- ===========================================================================
-- SECTION 23: REALTIME PUBLICATION
-- ===========================================================================

-- Add tables to the supabase_realtime publication
-- (Supabase creates this publication automatically; we just add our tables)
alter publication supabase_realtime
  add table public.notifications,
            public.bookings,
            public.released_slots,
            public.waitlist_entries;

-- ===========================================================================
-- SECTION 24: SCHEMA USAGE GRANTS
-- ===========================================================================

grant usage on schema public to anon, authenticated;

-- Tables readable by authenticated (not already handled by RLS)
grant select on public.institutions                     to authenticated;
grant select on public.profiles                         to authenticated;
grant select on public.qualifications                   to authenticated;
grant select on public.user_qualifications              to authenticated;
grant select on public.resources                        to authenticated;
grant select on public.eligibility_rules                to authenticated;
grant select on public.resource_required_qualifications to authenticated;
grant select on public.resource_accessories             to authenticated;
grant select on public.resource_availability_windows    to authenticated;
grant select on public.resource_evidence                to authenticated;
grant select on public.bookings                         to authenticated;
grant select on public.waitlist_entries                 to authenticated;
grant select on public.released_slots                   to authenticated;
grant select on public.custody_events                   to authenticated;
grant select on public.custody_photos                   to authenticated;
grant select on public.incidents                        to authenticated;
grant select on public.audit_log                        to authenticated;

-- anon only needs institution_directory (covered by view grant above)
-- Revoke all anon access to raw tables (institution_directory view handles discovery)
revoke all on public.institutions                     from anon;
revoke all on public.profiles                         from anon;
revoke all on public.qualifications                   from anon;
revoke all on public.user_qualifications              from anon;
revoke all on public.resources                        from anon;
revoke all on public.eligibility_rules                from anon;
revoke all on public.resource_required_qualifications from anon;
revoke all on public.resource_accessories             from anon;
revoke all on public.resource_availability_windows    from anon;
revoke all on public.resource_evidence                from anon;
revoke all on public.bookings                         from anon;
revoke all on public.waitlist_entries                 from anon;
revoke all on public.released_slots                   from anon;
revoke all on public.custody_events                   from anon;
revoke all on public.custody_photos                   from anon;
revoke all on public.incidents                        from anon;
revoke all on public.notifications                    from anon;
revoke all on public.audit_log                        from anon;

-- Resource-write tables: only admin can insert/update/delete (enforced by RLS + explicit grants)
grant insert, update, delete on public.resources                        to authenticated;
grant insert, update, delete on public.qualifications                   to authenticated;
grant insert, update, delete on public.user_qualifications              to authenticated;
grant insert, update, delete on public.eligibility_rules                to authenticated;
grant insert, update, delete on public.resource_required_qualifications to authenticated;
grant insert, update, delete on public.resource_accessories             to authenticated;
grant insert, update, delete on public.resource_availability_windows    to authenticated;
grant insert, update, delete on public.resource_evidence                to authenticated;
grant update (full_name, avatar_url) on public.profiles                 to authenticated;
