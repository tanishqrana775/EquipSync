-- =============================================================================
-- rls_isolation_test.sql
-- EquipSync - Comprehensive Multi-Tenant Isolation & RLS Quality Gate Tests.
-- Single transaction ending with ROLLBACK.
-- =============================================================================

begin;

do $$
declare
  -- Tenant A
  v_org_a_id      uuid := gen_random_uuid();
  v_admin_a_id    uuid := gen_random_uuid();
  v_member_a1_id  uuid := gen_random_uuid();
  v_member_a2_id  uuid := gen_random_uuid();

  -- Tenant B
  v_org_b_id      uuid := gen_random_uuid();
  v_admin_b_id    uuid := gen_random_uuid();
  v_member_b1_id  uuid := gen_random_uuid();

  -- Entities in Tenant A
  v_res_a1_id     uuid := gen_random_uuid();
  v_cat_a1_id     uuid := gen_random_uuid();
  v_bk_a1_id      uuid := gen_random_uuid();
  v_bk_a2_id      uuid := gen_random_uuid();
  v_event_a1_id   uuid := gen_random_uuid();
  v_photo_a1_id   uuid := gen_random_uuid();
  v_slot_a1_id    uuid := gen_random_uuid();
  v_inc_a1_id     uuid := gen_random_uuid();
  v_qual_a1_id    uuid := gen_random_uuid();
  v_notif_a1_id   uuid := gen_random_uuid();
  v_audit_a1_id   uuid := gen_random_uuid();

  -- Test helpers
  v_count         int;
  v_err_thrown    boolean;
  v_t_name        text;
  v_pol_name      text;
  v_r             record;
begin
  raise notice '============================================================';
  raise notice ' STARTING STRICT MULTI-TENANT ISOLATION & RLS VERIFICATION';
  raise notice '============================================================';

  -- -------------------------------------------------------------------------
  -- 1. SETUP TENANTS & USERS
  -- -------------------------------------------------------------------------
  insert into public.institutions (id, name, type, website_url, contact_phone, status, domain_proof, allowed_domains)
  values
    (v_org_a_id, 'Vivekananda Institute of Professional Studies', 'University', 'https://vips.edu', '+91 11 2734 3401', 'active', true, array['vips.edu']),
    (v_org_b_id, 'Delhi Institute of Engineering & Technology', 'College', 'https://diet.edu', '+91 11 2659 7100', 'active', true, array['diet.edu']);

  -- Tenant A Users
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values
    (v_admin_a_id, 'admin@vips.edu', now(), jsonb_build_object('role', 'institution_admin', 'full_name', 'VIPS Admin')),
    (v_member_a1_id, 'member1@vips.edu', now(), jsonb_build_object('role', 'member', 'full_name', 'VIPS Member 1')),
    (v_member_a2_id, 'member2@vips.edu', now(), jsonb_build_object('role', 'member', 'full_name', 'VIPS Member 2'));

  update public.profiles set institution_id = v_org_a_id, role = 'institution_admin', verification_status = 'verified' where id = v_admin_a_id;
  update public.profiles set institution_id = v_org_a_id, role = 'member', verification_status = 'verified' where id = v_member_a1_id;
  update public.profiles set institution_id = v_org_a_id, role = 'member', verification_status = 'verified' where id = v_member_a2_id;

  -- Tenant B Users
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values
    (v_admin_b_id, 'admin@diet.edu', now(), jsonb_build_object('role', 'institution_admin', 'full_name', 'DIET Admin')),
    (v_member_b1_id, 'member1@diet.edu', now(), jsonb_build_object('role', 'member', 'full_name', 'DIET Member 1'));

  update public.profiles set institution_id = v_org_b_id, role = 'institution_admin', verification_status = 'verified' where id = v_admin_b_id;
  update public.profiles set institution_id = v_org_b_id, role = 'member', verification_status = 'verified' where id = v_member_b1_id;

  -- Create Test Resource in Tenant A
  insert into public.resources (id, institution_id, name, kind, category, qr_identifier, asset_tag, is_available, status)
  values (v_res_a1_id, v_org_a_id, 'VIPS High-Precision Laser Cutter', 'equipment', 'Lab Equipment', 'EQS-VIPS-1', 'EQP-7K9M2W', true, 'active');

  insert into public.resource_categories (id, institution_id, name)
  values (v_cat_a1_id, v_org_a_id, 'Precision Lasers');

  -- Create Bookings in Tenant A
  insert into public.bookings (id, resource_id, user_id, institution_id, start_at, end_at, status, purpose)
  values
    (v_bk_a1_id, v_res_a1_id, v_member_a1_id, v_org_a_id, now() + interval '1 hour', now() + interval '3 hours', 'approved', 'Robotics cutting'),
    (v_bk_a2_id, v_res_a1_id, v_member_a2_id, v_org_a_id, now() + interval '4 hours', now() + interval '6 hours', 'pending', 'Component testing');

  -- Create Released Slot in Tenant A
  insert into public.released_slots (id, booking_id, resource_id, institution_id, start_at, end_at, released_by, status)
  values (v_slot_a1_id, v_bk_a1_id, v_res_a1_id, v_org_a_id, now() + interval '1 hour', now() + interval '3 hours', v_member_a1_id, 'open');

  -- Create Incident in Tenant A
  insert into public.incidents (id, booking_id, resource_id, institution_id, reported_by, severity, type, description, status)
  values (v_inc_a1_id, v_bk_a1_id, v_res_a1_id, v_org_a_id, v_member_a1_id, 'low', 'other', 'Minor lens smudge', 'open');

  -- Create Qualification in Tenant A
  insert into public.qualifications (id, institution_id, name)
  values (v_qual_a1_id, v_org_a_id, 'Laser Safety induction');

  -- Create Notification for Member A1
  insert into public.notifications (id, user_id, type, title, body)
  values (v_notif_a1_id, v_member_a1_id, 'booking_approved', 'Booking Approved', 'Your booking is ready');

  raise notice 'PASS: Test harness provisioned for Tenant A and Tenant B.';

  -- -------------------------------------------------------------------------
  -- 2. SCHEMA LINT CHECK: RLS ENABLED ON EVERY PUBLIC TABLE
  -- -------------------------------------------------------------------------
  for v_r in
    select c.relname as table_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relname not in ('schema_migrations', 'spatial_ref_sys')
      and not c.relrowsecurity
  loop
    raise exception 'RLS LINT FAILED: Table public.% does not have Row Level Security enabled!', v_r.table_name;
  end loop;

  raise notice 'PASS: All public schema tables have Row Level Security (RLS) enabled.';

  -- -------------------------------------------------------------------------
  -- 3. CHECK CLIENT-WRITABLE INSERT WITH CHECK GUARANTEE
  -- -------------------------------------------------------------------------
  for v_r in
    select polname, tablename
    from pg_policies
    where schemaname = 'public'
      and cmd = 'INSERT'
      and tablename in ('resources', 'qualifications', 'user_qualifications', 'resource_categories', 'resource_accessories')
      and with_check is null
  loop
    raise exception 'INSERT POLICY LINT FAILED: Policy % on table % missing WITH CHECK clause!', v_r.polname, v_r.tablename;
  end loop;

  raise notice 'PASS: All client-writable INSERT policies enforce defensive WITH CHECK.';

  -- -------------------------------------------------------------------------
  -- 4. CROSS-TENANT ISOLATION: TENANT B ADMIN SEES ZERO ROWS IN TENANT A
  -- -------------------------------------------------------------------------
  set local role authenticated;
  set local "request.jwt.claim.sub" to v_admin_b_id;
  set local "request.jwt.claim.role" to 'authenticated';

  -- Resources
  select count(*) into v_count from public.resources where id = v_res_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B admin can view Tenant A resources!'; end if;

  -- Bookings
  select count(*) into v_count from public.bookings where id = v_bk_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B admin can view Tenant A bookings!'; end if;

  -- Incidents
  select count(*) into v_count from public.incidents where id = v_inc_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B admin can view Tenant A incidents!'; end if;

  -- Qualifications
  select count(*) into v_count from public.qualifications where id = v_qual_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B admin can view Tenant A qualifications!'; end if;

  -- Released Slots
  select count(*) into v_count from public.released_slots where id = v_slot_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B admin can view Tenant A released slots!'; end if;

  -- Profiles
  select count(*) into v_count from public.profiles where id = v_member_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B admin can view Tenant A member profile!'; end if;

  raise notice 'PASS: Cross-tenant isolation verified for Tenant B Admin (zero rows accessible).';

  -- -------------------------------------------------------------------------
  -- 5. CROSS-TENANT ISOLATION: TENANT B MEMBER SEES ZERO ROWS IN TENANT A
  -- -------------------------------------------------------------------------
  set local "request.jwt.claim.sub" to v_member_b1_id;

  select count(*) into v_count from public.resources where id = v_res_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B member can view Tenant A resources!'; end if;

  select count(*) into v_count from public.bookings where id = v_bk_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B member can view Tenant A bookings!'; end if;

  select count(*) into v_count from public.notifications where id = v_notif_a1_id;
  if v_count <> 0 then raise exception 'TENANT ISOLATION FAILED: Tenant B member can view Tenant A notifications!'; end if;

  raise notice 'PASS: Cross-tenant isolation verified for Tenant B Member (zero rows accessible).';

  -- -------------------------------------------------------------------------
  -- 6. INTRA-TENANT PRIVACY: MEMBER A2 CANNOT SEE MEMBER A1'S BOOKING DIRECTLY
  -- -------------------------------------------------------------------------
  set local "request.jwt.claim.sub" to v_member_a2_id;

  select count(*) into v_count from public.bookings where id = v_bk_a1_id;
  if v_count <> 0 then raise exception 'INTRA-TENANT PRIVACY FAILED: Member A2 can view Member A1 private booking!'; end if;

  -- But Member A2 CAN see their own booking A2
  select count(*) into v_count from public.bookings where id = v_bk_a2_id;
  if v_count <> 1 then raise exception 'INTRA-TENANT ACCESS FAILED: Member A2 cannot view their own booking!'; end if;

  raise notice 'PASS: Intra-tenant privacy between members verified.';

  -- -------------------------------------------------------------------------
  -- 7. APPROVAL HARDENING & PENDING LOCK VERIFICATION
  -- -------------------------------------------------------------------------
  -- Attempting check_out_booking on pending booking A2 must raise booking_pending_approval
  v_err_thrown := false;
  begin
    perform public.check_out_booking(
      v_bk_a2_id,
      '[]'::jsonb,
      'good'::public.condition_rating,
      'notes',
      '[]'::jsonb,
      'EQS-VIPS-1'
    );
  exception when others then
    if SQLERRM like '%booking_pending_approval%' then
      v_err_thrown := true;
    end if;
  end;

  if not v_err_thrown then
    raise exception 'APPROVAL LOCK FAILED: check_out_booking on pending booking did not raise booking_pending_approval!';
  end if;

  raise notice 'PASS: Checkout on pending booking correctly raises booking_pending_approval.';

  -- -------------------------------------------------------------------------
  -- 8. ANONYMOUS ROLE ACCESS GATES
  -- -------------------------------------------------------------------------
  set local role anon;
  set local "request.jwt.claim.sub" to '';

  -- Assert anon gets 0 rows from institutions directly
  select count(*) into v_count from public.institutions;
  if v_count <> 0 then raise exception 'ANON ACCESS FAILED: anon can select directly from institutions!'; end if;

  -- Assert anon CAN call organization_name_available
  if not public.organization_name_available('NonExistentOrgName123XYZ') then
    raise exception 'ANON RPC FAILED: anon cannot call organization_name_available!';
  end if;

  raise notice 'PASS: Anonymous role access restrictions and public RPC gates verified.';

  raise notice '============================================================';
  raise notice ' ALL MULTI-TENANT ISOLATION & RLS QUALITY GATES PASSED!';
  raise notice '============================================================';
end $$;

rollback;
