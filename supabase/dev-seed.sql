-- =============================================================================
-- DEV/STAGING ONLY
-- dev-seed.sql  –  EquipSync demo data (idempotent)
-- Run after all migrations.
-- Does NOT insert profiles or bookings (those require auth users).
-- =============================================================================

do $$
declare
  v_inst_id   uuid;

  -- qualification ids
  v_qual_laser    uuid;
  v_qual_lab      uuid;
  v_qual_camera   uuid;
  v_qual_3dp      uuid;
  v_qual_clean    uuid;

  -- resource ids
  v_res_cam1      uuid;
  v_res_cam2      uuid;
  v_res_laptop1   uuid;
  v_res_laptop2   uuid;
  v_res_3dprint   uuid;
  v_res_laser     uuid;
  v_res_micro     uuid;
  v_res_proj      uuid;
  v_res_lab1      uuid;
  v_res_lab2      uuid;
  v_res_seminar   uuid;
begin

  -- -------------------------------------------------------------------------
  -- Institution
  -- -------------------------------------------------------------------------
  insert into public.institutions (name, type, email_domain, address)
  values (
    'Riverside Institute of Technology',
    'university',
    'riverside.edu',
    '1 University Drive, Riverside, CA 92507'
  )
  on conflict do nothing;

  select id into v_inst_id
  from   public.institutions
  where  name = 'Riverside Institute of Technology';

  -- -------------------------------------------------------------------------
  -- Qualifications (5)
  -- -------------------------------------------------------------------------
  insert into public.qualifications (institution_id, name) values
    (v_inst_id, 'Laser Safety'),
    (v_inst_id, 'Lab Induction'),
    (v_inst_id, 'Camera Training'),
    (v_inst_id, '3D Printer Certified'),
    (v_inst_id, 'Cleanroom Access')
  on conflict (institution_id, name) do nothing;

  select id into v_qual_laser  from public.qualifications where institution_id = v_inst_id and name = 'Laser Safety';
  select id into v_qual_lab    from public.qualifications where institution_id = v_inst_id and name = 'Lab Induction';
  select id into v_qual_camera from public.qualifications where institution_id = v_inst_id and name = 'Camera Training';
  select id into v_qual_3dp    from public.qualifications where institution_id = v_inst_id and name = '3D Printer Certified';
  select id into v_qual_clean  from public.qualifications where institution_id = v_inst_id and name = 'Cleanroom Access';

  -- -------------------------------------------------------------------------
  -- Resources (10) + eligibility_rules + accessories + availability windows
  -- -------------------------------------------------------------------------

  -- 1. DSLR Camera Alpha
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Canon EOS R5 Camera', 'equipment', 'DSLR Cameras',
          'Full-frame mirrorless camera with 45MP sensor. Includes 24-70mm lens, battery grip and two batteries.',
          'Media Centre – Cabinet A2', 'RIT-CAM-001', true, 'active', '{front,back,left,right,top}')
  on conflict do nothing
  returning id into v_res_cam1;
  if v_res_cam1 is null then
    select id into v_res_cam1 from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-CAM-001';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_cam1, true, false, '{student,staff}', 2880, 60)
  on conflict (resource_id) do nothing;

  insert into public.resource_required_qualifications (resource_id, qualification_id)
  values (v_res_cam1, v_qual_camera)
  on conflict do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_cam1, '24-70mm Lens', true),
    (v_res_cam1, 'Battery Grip', true),
    (v_res_cam1, 'Battery x2', true),
    (v_res_cam1, 'Camera Bag', false)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_cam1, 1, '09:00', '18:00'), (v_res_cam1, 2, '09:00', '18:00'),
    (v_res_cam1, 3, '09:00', '18:00'), (v_res_cam1, 4, '09:00', '18:00'),
    (v_res_cam1, 5, '09:00', '18:00')
  on conflict do nothing;

  -- 2. DSLR Camera Beta
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Sony A7 IV Camera', 'equipment', 'DSLR Cameras',
          'Full-frame mirrorless camera, 33MP. Includes 28-70mm kit lens and standard battery.',
          'Media Centre – Cabinet A3', 'RIT-CAM-002', true, 'active', '{front,back,left,right}')
  on conflict do nothing
  returning id into v_res_cam2;
  if v_res_cam2 is null then
    select id into v_res_cam2 from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-CAM-002';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_cam2, true, false, '{student,staff}', 2880, 60)
  on conflict (resource_id) do nothing;

  insert into public.resource_required_qualifications (resource_id, qualification_id)
  values (v_res_cam2, v_qual_camera)
  on conflict do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_cam2, '28-70mm Lens', true),
    (v_res_cam2, 'Battery', true)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_cam2, 1, '09:00', '18:00'), (v_res_cam2, 2, '09:00', '18:00'),
    (v_res_cam2, 3, '09:00', '18:00'), (v_res_cam2, 4, '09:00', '18:00'),
    (v_res_cam2, 5, '09:00', '18:00')
  on conflict do nothing;

  -- 3. Laptop Alpha
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'MacBook Pro 16" (M3 Pro)', 'equipment', 'Laptops',
          '16-inch MacBook Pro with M3 Pro chip, 36GB RAM, 1TB SSD. Pre-loaded with Adobe Creative Suite and development tools.',
          'IT Lending Desk – Shelf B1', 'RIT-LAP-001', true, 'active', '{front,back}')
  on conflict do nothing
  returning id into v_res_laptop1;
  if v_res_laptop1 is null then
    select id into v_res_laptop1 from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-LAP-001';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_laptop1, false, false, '{student,staff,external}', 1440, 0)
  on conflict (resource_id) do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_laptop1, 'MagSafe Charger', true),
    (v_res_laptop1, 'USB-C Hub', false)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_laptop1, 1, '09:00', '18:00'), (v_res_laptop1, 2, '09:00', '18:00'),
    (v_res_laptop1, 3, '09:00', '18:00'), (v_res_laptop1, 4, '09:00', '18:00'),
    (v_res_laptop1, 5, '09:00', '18:00'), (v_res_laptop1, 6, '10:00', '16:00')
  on conflict do nothing;

  -- 4. Laptop Beta
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Dell XPS 15 (Intel Core Ultra 9)', 'equipment', 'Laptops',
          '15-inch Dell XPS 15, 32GB RAM, 1TB SSD, NVIDIA RTX 4060. Suitable for data science workloads.',
          'IT Lending Desk – Shelf B2', 'RIT-LAP-002', true, 'active', '{front,back}')
  on conflict do nothing
  returning id into v_res_laptop2;
  if v_res_laptop2 is null then
    select id into v_res_laptop2 from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-LAP-002';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_laptop2, false, false, '{student,staff,external}', 1440, 0)
  on conflict (resource_id) do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_laptop2, 'Power Adapter', true)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_laptop2, 1, '09:00', '18:00'), (v_res_laptop2, 2, '09:00', '18:00'),
    (v_res_laptop2, 3, '09:00', '18:00'), (v_res_laptop2, 4, '09:00', '18:00'),
    (v_res_laptop2, 5, '09:00', '18:00')
  on conflict do nothing;

  -- 5. 3D Printer
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Bambu Lab X1 Carbon 3D Printer', 'equipment', 'Lab Equipment',
          'Multi-material 3D printer with 256x256x256mm build volume. AMS unit with 4 filament slots.',
          'Fabrication Lab – Bay 3', 'RIT-3DP-001', true, 'active', '{front,back,left,right}')
  on conflict do nothing
  returning id into v_res_3dprint;
  if v_res_3dprint is null then
    select id into v_res_3dprint from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-3DP-001';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_3dprint, true, false, '{student,staff}', 480, 120)
  on conflict (resource_id) do nothing;

  insert into public.resource_required_qualifications (resource_id, qualification_id)
  values (v_res_3dprint, v_qual_3dp)
  on conflict do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_3dprint, 'AMS Unit', true),
    (v_res_3dprint, 'Spare Nozzle Kit', false),
    (v_res_3dprint, 'Filament (user-supplied)', false)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_3dprint, 1, '09:00', '18:00'), (v_res_3dprint, 2, '09:00', '18:00'),
    (v_res_3dprint, 3, '09:00', '18:00'), (v_res_3dprint, 4, '09:00', '18:00'),
    (v_res_3dprint, 5, '09:00', '18:00')
  on conflict do nothing;

  -- 6. Laser Cutter
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Trotec Speedy 400 Laser Cutter', 'equipment', 'Lab Equipment',
          '100W CO₂ laser cutter/engraver, 1000x610mm work area. Suitable for wood, acrylic, leather and anodised metals.',
          'Fabrication Lab – Bay 1', 'RIT-LSR-001', true, 'active', '{front,back,left,right}')
  on conflict do nothing
  returning id into v_res_laser;
  if v_res_laser is null then
    select id into v_res_laser from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-LSR-001';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_laser, true, true, '{student,staff}', 240, 240)
  on conflict (resource_id) do nothing;

  insert into public.resource_required_qualifications (resource_id, qualification_id) values
    (v_res_laser, v_qual_laser),
    (v_res_laser, v_qual_lab)
  on conflict do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_laser, 'Safety Goggles', true),
    (v_res_laser, 'Exhaust Hose', true),
    (v_res_laser, 'Focus Tool', true)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_laser, 1, '09:00', '18:00'), (v_res_laser, 2, '09:00', '18:00'),
    (v_res_laser, 3, '09:00', '18:00'), (v_res_laser, 4, '09:00', '18:00'),
    (v_res_laser, 5, '09:00', '18:00')
  on conflict do nothing;

  -- 7. Microscope
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Zeiss Axio Observer 7 Microscope', 'equipment', 'Lab Equipment',
          'Inverted fluorescence microscope with motorised stage. Suitable for cell biology and materials research.',
          'Biology Lab – Bench 4', 'RIT-MIC-001', true, 'active', '{front,back,left,right}')
  on conflict do nothing
  returning id into v_res_micro;
  if v_res_micro is null then
    select id into v_res_micro from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-MIC-001';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_micro, true, false, '{student,staff}', 480, 60)
  on conflict (resource_id) do nothing;

  insert into public.resource_required_qualifications (resource_id, qualification_id)
  values (v_res_micro, v_qual_lab)
  on conflict do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_micro, 'Objective Lens Set (4x,10x,20x,40x)', true),
    (v_res_micro, 'Immersion Oil', false)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_micro, 1, '09:00', '18:00'), (v_res_micro, 2, '09:00', '18:00'),
    (v_res_micro, 3, '09:00', '18:00'), (v_res_micro, 4, '09:00', '18:00'),
    (v_res_micro, 5, '09:00', '18:00')
  on conflict do nothing;

  -- 8. Projector
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Epson EB-L1075U Laser Projector', 'equipment', 'Audio/Visual',
          '7000-lumen WUXGA laser projector with lens shift and 4K enhancement. Includes remote and HDMI cable.',
          'AV Store – Room G04', 'RIT-PRJ-001', true, 'active', '{front,back}')
  on conflict do nothing
  returning id into v_res_proj;
  if v_res_proj is null then
    select id into v_res_proj from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-PRJ-001';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_proj, false, false, '{student,staff,external}', 480, 30)
  on conflict (resource_id) do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_proj, 'Remote Control', true),
    (v_res_proj, 'HDMI Cable 3m', true),
    (v_res_proj, 'Power Cable', true),
    (v_res_proj, 'Carrying Case', false)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_proj, 1, '09:00', '18:00'), (v_res_proj, 2, '09:00', '18:00'),
    (v_res_proj, 3, '09:00', '18:00'), (v_res_proj, 4, '09:00', '18:00'),
    (v_res_proj, 5, '09:00', '18:00'), (v_res_proj, 6, '09:00', '14:00')
  on conflict do nothing;

  -- 9. Lab – Cleanroom
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Class 100 Cleanroom (Lab A)', 'lab', 'Lab Equipment',
          'ISO 5 cleanroom with laminar flow hoods, gowning area and ESD workbenches. Capacity: 4 people.',
          'Engineering Block – Level 2, Lab A', 'RIT-CRM-001', true, 'active', '{front,back,left,right}')
  on conflict do nothing
  returning id into v_res_lab1;
  if v_res_lab1 is null then
    select id into v_res_lab1 from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-CRM-001';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_lab1, true, true, '{staff}', 480, 240)
  on conflict (resource_id) do nothing;

  insert into public.resource_required_qualifications (resource_id, qualification_id) values
    (v_res_lab1, v_qual_clean),
    (v_res_lab1, v_qual_lab)
  on conflict do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_lab1, 'Cleanroom Gown Set', true),
    (v_res_lab1, 'ESD Wrist Strap', true),
    (v_res_lab1, 'Particle Counter', false)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_lab1, 1, '09:00', '18:00'), (v_res_lab1, 2, '09:00', '18:00'),
    (v_res_lab1, 3, '09:00', '18:00'), (v_res_lab1, 4, '09:00', '18:00'),
    (v_res_lab1, 5, '09:00', '18:00')
  on conflict do nothing;

  -- 10. Lab – General
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'General Research Lab (Lab B)', 'lab', 'Lab Equipment',
          'Multi-purpose research lab with fume hoods, centrifuges and standard bench equipment. Capacity: 8 people.',
          'Science Block – Level 1, Lab B', 'RIT-LAB-002', true, 'active', '{front,back,left,right}')
  on conflict do nothing
  returning id into v_res_lab2;
  if v_res_lab2 is null then
    select id into v_res_lab2 from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-LAB-002';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_lab2, true, false, '{student,staff}', 480, 60)
  on conflict (resource_id) do nothing;

  insert into public.resource_required_qualifications (resource_id, qualification_id)
  values (v_res_lab2, v_qual_lab)
  on conflict do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_lab2, 'Lab Coat', true),
    (v_res_lab2, 'Safety Goggles', true)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_lab2, 1, '09:00', '18:00'), (v_res_lab2, 2, '09:00', '18:00'),
    (v_res_lab2, 3, '09:00', '18:00'), (v_res_lab2, 4, '09:00', '18:00'),
    (v_res_lab2, 5, '09:00', '18:00')
  on conflict do nothing;

  -- 11. Seminar Room  (counts as resource #10 spatial)
  insert into public.resources (institution_id, name, kind, category, description, location, asset_tag, is_available, status, required_photo_slots)
  values (v_inst_id, 'Executive Seminar Room (SR-201)', 'space', 'Seminar Halls',
          'Boardroom-style seminar room with 4K display, video conferencing system and seating for 20.',
          'Admin Block – Level 2, Room 201', 'RIT-SEM-001', true, 'active', '{front,back}')
  on conflict do nothing
  returning id into v_res_seminar;
  if v_res_seminar is null then
    select id into v_res_seminar from public.resources where institution_id = v_inst_id and asset_tag = 'RIT-SEM-001';
  end if;

  insert into public.eligibility_rules (resource_id, requires_approval, requires_supervision, allowed_user_types, max_duration_minutes, min_lead_time_minutes)
  values (v_res_seminar, true, false, '{student,staff,external}', 480, 60)
  on conflict (resource_id) do nothing;

  insert into public.resource_accessories (resource_id, name, required) values
    (v_res_seminar, '4K Display Remote', true),
    (v_res_seminar, 'Video Conferencing Remote', true),
    (v_res_seminar, 'Whiteboard Markers Set', false)
  on conflict do nothing;

  insert into public.resource_availability_windows (resource_id, weekday, start_time, end_time) values
    (v_res_seminar, 1, '09:00', '18:00'), (v_res_seminar, 2, '09:00', '18:00'),
    (v_res_seminar, 3, '09:00', '18:00'), (v_res_seminar, 4, '09:00', '18:00'),
    (v_res_seminar, 5, '09:00', '18:00'), (v_res_seminar, 6, '09:00', '13:00')
  on conflict do nothing;

end;
$$;
