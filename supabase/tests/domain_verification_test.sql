-- =============================================================================
-- domain_verification_test.sql
-- EquipSync – Comprehensive Unit Tests for Domain Verification & Auto-Approval
-- Single transaction ending with ROLLBACK.
-- =============================================================================

begin;

-- Create an isolated test harness
do $$
declare
  v_org_a_id    uuid;
  v_org_b_id    uuid;
  v_admin_a_id  uuid := gen_random_uuid();
  v_admin_b_id  uuid := gen_random_uuid();
  v_u_exact_id  uuid := gen_random_uuid();
  v_u_unconf_id uuid := gen_random_uuid();
  v_u_norm_id   uuid := gen_random_uuid();
  v_u_sub_id    uuid := gen_random_uuid();
  v_u_wild_id   uuid := gen_random_uuid();
  v_u_wild_bare uuid := gen_random_uuid();
  v_u_trap1_id  uuid := gen_random_uuid();
  v_u_trap2_id  uuid := gen_random_uuid();
  v_u_trap3_id  uuid := gen_random_uuid();
  v_u_rej_id    uuid := gen_random_uuid();
  v_u_diff_id   uuid := gen_random_uuid();
  v_prof        record;
  v_res_json    jsonb;
  v_matched     record;
  v_err_thrown  boolean;
begin
  raise notice '============================================================';
  raise notice ' STARTING DOMAIN VERIFICATION TEST SUITE';
  raise notice '============================================================';

  -- -------------------------------------------------------------------------
  -- SETUP: Create Test Organizations A and B
  -- -------------------------------------------------------------------------
  insert into public.institutions (id, name, type, allowed_domains)
  values (
    gen_random_uuid(),
    'Imperial College of Science',
    'University',
    array['imperial.ac.uk', '*.research.imperial.ac.uk']
  )
  returning id into v_org_a_id;

  insert into public.institutions (id, name, type, allowed_domains)
  values (
    gen_random_uuid(),
    'Cambridge Innovation Hub',
    'University',
    array['cambridge.ac.uk']
  )
  returning id into v_org_b_id;

  raise notice 'PASS: Test organizations created successfully.';

  -- -------------------------------------------------------------------------
  -- TEST 1: Confirmed insert with exact domain -> verified, linked, method 'domain'
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_u_exact_id,
    'student1@imperial.ac.uk',
    now(),
    jsonb_build_object('role', 'member', 'full_name', 'Student Exact')
  );

  select * into v_prof from public.profiles where id = v_u_exact_id;
  if v_prof.verification_status <> 'verified' or v_prof.verification_method <> 'domain' or v_prof.institution_id <> v_org_a_id then
    raise exception 'TEST 1 FAILED: Expected verified via domain for Org A, got status=%, method=%, inst=%',
      v_prof.verification_status, v_prof.verification_method, v_prof.institution_id;
  end if;
  raise notice 'PASS: Test 1 - Confirmed insert with exact domain auto-verified.';

  -- -------------------------------------------------------------------------
  -- TEST 2: Unconfirmed insert stays pending and becomes verified when email_confirmed_at is set
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_u_unconf_id,
    'unconfirmed@imperial.ac.uk',
    null,
    jsonb_build_object('role', 'member', 'full_name', 'Student Unconfirmed')
  );

  select * into v_prof from public.profiles where id = v_u_unconf_id;
  if v_prof.verification_status <> 'pending' or v_prof.verification_method is not null then
    raise exception 'TEST 2A FAILED: Unconfirmed user must start as pending';
  end if;

  -- Confirm email
  update auth.users
  set email_confirmed_at = now()
  where id = v_u_unconf_id;

  select * into v_prof from public.profiles where id = v_u_unconf_id;
  if v_prof.verification_status <> 'verified' or v_prof.verification_method <> 'domain' or v_prof.institution_id <> v_org_a_id then
    raise exception 'TEST 2B FAILED: User should become verified upon email confirmation';
  end if;
  raise notice 'PASS: Test 2 - Unconfirmed user transitions to verified on email confirmation.';

  -- -------------------------------------------------------------------------
  -- TEST 3: Uppercase and whitespace normalization
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_u_norm_id,
    '  MEMBER.UPPER@IMPERIAL.AC.UK  ',
    now(),
    jsonb_build_object('role', 'member', 'full_name', 'Uppercase Member')
  );

  select * into v_prof from public.profiles where id = v_u_norm_id;
  if v_prof.verification_status <> 'verified' or v_prof.institution_id <> v_org_a_id then
    raise exception 'TEST 3 FAILED: Uppercase email failed to auto-verify';
  end if;
  raise notice 'PASS: Test 3 - Uppercase and whitespace normalized correctly.';

  -- -------------------------------------------------------------------------
  -- TEST 4: Subdomain does NOT match an exact entry
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_u_sub_id,
    'sub@dept.cambridge.ac.uk',
    now(),
    jsonb_build_object('role', 'member', 'full_name', 'Subdomain Member')
  );

  select * into v_prof from public.profiles where id = v_u_sub_id;
  if v_prof.verification_status = 'verified' then
    raise exception 'TEST 4 FAILED: Subdomain must not match exact domain entry cambridge.ac.uk';
  end if;
  raise notice 'PASS: Test 4 - Subdomain does not match exact domain entry.';

  -- -------------------------------------------------------------------------
  -- TEST 5: *.domain matches subdomains but not bare domain
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_u_wild_id,
    'fellow@robotics.research.imperial.ac.uk',
    now(),
    jsonb_build_object('role', 'member', 'full_name', 'Robotics Fellow')
  );

  select * into v_prof from public.profiles where id = v_u_wild_id;
  if v_prof.verification_status <> 'verified' or v_prof.institution_id <> v_org_a_id then
    raise exception 'TEST 5A FAILED: *.research.imperial.ac.uk must match robotics.research.imperial.ac.uk';
  end if;

  -- Test bare domain against a wildcard-only setup
  insert into public.institutions (id, name, type, allowed_domains)
  values (gen_random_uuid(), 'Wildcard Only Org', 'Workshop', array['*.wildcard.org'])
  returning id into v_org_b_id;

  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_u_wild_bare,
    'bare@wildcard.org',
    now(),
    jsonb_build_object('role', 'member', 'full_name', 'Bare User')
  );

  select * into v_prof from public.profiles where id = v_u_wild_bare;
  if v_prof.verification_status = 'verified' then
    raise exception 'TEST 5B FAILED: *.wildcard.org must not match bare wildcard.org';
  end if;
  raise notice 'PASS: Test 5 - Wildcard matches subdomains properly without capturing bare domain.';

  -- -------------------------------------------------------------------------
  -- TEST 6: Suffix traps (evilvips.edu, vips.edu.attacker.com, notvips.edu)
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values
    (v_u_trap1_id, 'hacker@notimperial.ac.uk', now(), jsonb_build_object('role', 'member')),
    (v_u_trap2_id, 'hacker@imperial.ac.uk.attacker.com', now(), jsonb_build_object('role', 'member')),
    (v_u_trap3_id, 'hacker@evilmperial.ac.uk', now(), jsonb_build_object('role', 'member'));

  if exists (
    select 1 from public.profiles
    where id in (v_u_trap1_id, v_u_trap2_id, v_u_trap3_id) and verification_status = 'verified'
  ) then
    raise exception 'TEST 6 FAILED: Suffix traps were incorrectly verified!';
  end if;
  raise notice 'PASS: Test 6 - Suffix traps rejected securely.';

  -- -------------------------------------------------------------------------
  -- TEST 7: A rejected profile stays rejected after confirmation
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (v_u_rej_id, 'declined@imperial.ac.uk', null, jsonb_build_object('role', 'member'));

  update public.profiles set verification_status = 'rejected' where id = v_u_rej_id;

  -- Confirm email
  update auth.users set email_confirmed_at = now() where id = v_u_rej_id;

  select * into v_prof from public.profiles where id = v_u_rej_id;
  if v_prof.verification_status <> 'rejected' then
    raise exception 'TEST 7 FAILED: Rejected status must not be overwritten by auto-verification';
  end if;
  raise notice 'PASS: Test 7 - Rejected status respected and preserved.';

  -- -------------------------------------------------------------------------
  -- TEST 8: A member who chose another organization stays pending there
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_u_diff_id,
    'student@imperial.ac.uk',
    now(),
    jsonb_build_object('role', 'member', 'institution_id', v_org_b_id)
  );

  select * into v_prof from public.profiles where id = v_u_diff_id;
  if v_prof.verification_status = 'verified' or v_prof.institution_id <> v_org_b_id then
    raise exception 'TEST 8 FAILED: Member affiliated with Org B must not be auto-verified for Org A';
  end if;
  raise notice 'PASS: Test 8 - Member with different organization affiliation stays pending.';

  -- -------------------------------------------------------------------------
  -- TEST 9: Admins are never changed
  -- -------------------------------------------------------------------------
  insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
  values (
    v_admin_a_id,
    'admin@imperial.ac.uk',
    now(),
    jsonb_build_object('role', 'institution_admin', 'institution_name', 'Imperial Admin Test')
  );

  select * into v_prof from public.profiles where id = v_admin_a_id;
  if v_prof.role <> 'institution_admin' or v_prof.verification_status <> 'verified' or v_prof.verification_method <> 'admin' then
    raise exception 'TEST 9 FAILED: Admin profile role or status corrupted';
  end if;
  raise notice 'PASS: Test 9 - Admin profiles are never modified by domain auto-verification.';

  -- -------------------------------------------------------------------------
  -- TEST 10: A second organization cannot claim the same domain (domain_already_claimed)
  -- -------------------------------------------------------------------------
  v_err_thrown := false;
  begin
    insert into public.institutions (name, type, allowed_domains)
    values ('Duplicate Domain Org', 'University', array['imperial.ac.uk']);
  exception when others then
    if SQLERRM like '%domain_already_claimed%' then
      v_err_thrown := true;
    end if;
  end;

  if not v_err_thrown then
    raise exception 'TEST 10 FAILED: Expected domain_already_claimed exception';
  end if;
  raise notice 'PASS: Test 10 - Duplicate domain claim blocked.';

  -- -------------------------------------------------------------------------
  -- TEST 11: Public providers are rejected (domain_not_allowed)
  -- -------------------------------------------------------------------------
  v_err_thrown := false;
  begin
    insert into public.institutions (name, type, allowed_domains)
    values ('Public Mail Org', 'Workshop', array['gmail.com']);
  exception when others then
    if SQLERRM like '%domain_not_allowed%' then
      v_err_thrown := true;
    end if;
  end;

  if not v_err_thrown then
    raise exception 'TEST 11 FAILED: Expected domain_not_allowed exception for gmail.com';
  end if;
  raise notice 'PASS: Test 11 - Public mail providers rejected.';

  -- -------------------------------------------------------------------------
  -- TEST 12: match_organization_by_email results
  -- -------------------------------------------------------------------------
  select * into v_matched from public.match_organization_by_email('test@imperial.ac.uk');
  if v_matched.id <> v_org_a_id then
    raise exception 'TEST 12 FAILED: match_organization_by_email failed to match Org A';
  end if;

  select * into v_matched from public.match_organization_by_email('nobody@unknown-domain-xyz.com');
  if v_matched.id is not null then
    raise exception 'TEST 12 FAILED: match_organization_by_email should return null for unmatched';
  end if;
  raise notice 'PASS: Test 12 - match_organization_by_email returns correct matches.';

  raise notice '============================================================';
  raise notice ' ALL DOMAIN VERIFICATION UNIT TESTS PASSED!';
  raise notice '============================================================';
end $$;

rollback;
