-- 0009_rpc_grants.sql
-- EquipSync – Idempotent Safety Net Grants for Custody V2 RPCs & Directory Search

do $$
declare f record;
begin
  if to_regprocedure('public.regenerate_resource_qr(uuid)') is null then
    raise exception 'regenerate_resource_qr(uuid) is missing: apply 0008_custody_v2.sql first';
  end if;
  for f in select p.oid::regprocedure as sig from pg_proc p
    where p.pronamespace = 'public'::regnamespace
    and p.proname in ('regenerate_resource_qr','verify_asset_qr','start_checkout','start_return','check_out_booking','check_in_booking','inspect_return','resolve_dispute','get_custody_timeline','search_institutions')
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
  execute 'grant execute on function public.search_institutions(text) to anon';
end $$;
notify pgrst, 'reload schema';
