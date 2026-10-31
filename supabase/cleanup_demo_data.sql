-- =============================================================================
-- cleanup_demo_data.sql  –  EquipSync
-- Deletes the demo institution "Riverside Institute of Technology" and all
-- dependent records in strict foreign-key order.
-- Safe and idempotent: wraps in a transaction and no-ops if absent.
-- DO NOT RUN AUTOMATICALLY (DEV/STAGING UTILITY ONLY).
-- =============================================================================

begin;

do $$
declare
  v_inst_id uuid;
begin
  select id into v_inst_id
  from public.institutions
  where name = 'Riverside Institute of Technology';

  if v_inst_id is null then
    raise notice 'Demo institution "Riverside Institute of Technology" does not exist. Nothing to clean up.';
    return;
  end if;

  -- 1. Incidents
  delete from public.incidents
  where institution_id = v_inst_id;

  -- 2. Custody photos & events
  delete from public.custody_photos
  where booking_id in (select id from public.bookings where institution_id = v_inst_id);

  delete from public.custody_events
  where booking_id in (select id from public.bookings where institution_id = v_inst_id);

  -- 3. Released slots
  delete from public.released_slots
  where institution_id = v_inst_id;

  -- 4. Bookings (restrict constraint on resource_id, must be deleted before resources)
  delete from public.bookings
  where institution_id = v_inst_id;

  -- 5. Waitlist entries
  delete from public.waitlist_entries
  where resource_id in (select id from public.resources where institution_id = v_inst_id);

  -- 6. Resource sub-tables
  delete from public.resource_evidence
  where resource_id in (select id from public.resources where institution_id = v_inst_id);

  delete from public.resource_availability_windows
  where resource_id in (select id from public.resources where institution_id = v_inst_id);

  delete from public.resource_accessories
  where resource_id in (select id from public.resources where institution_id = v_inst_id);

  delete from public.resource_required_qualifications
  where resource_id in (select id from public.resources where institution_id = v_inst_id);

  delete from public.eligibility_rules
  where resource_id in (select id from public.resources where institution_id = v_inst_id);

  -- 7. Resources
  delete from public.resources
  where institution_id = v_inst_id;

  -- 8. User qualifications and qualifications
  delete from public.user_qualifications
  where qualification_id in (select id from public.qualifications where institution_id = v_inst_id);

  delete from public.qualifications
  where institution_id = v_inst_id;

  -- 9. Profiles referencing institution
  update public.profiles
  set institution_id = null
  where institution_id = v_inst_id;

  -- 10. Audit log referencing institution
  update public.audit_log
  set institution_id = null
  where institution_id = v_inst_id;

  -- 11. Institution record
  delete from public.institutions
  where id = v_inst_id;

  raise notice 'Successfully cleaned up demo institution % and all dependent data.', v_inst_id;
end;
$$;

commit;
