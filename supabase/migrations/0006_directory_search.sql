-- =============================================================================
-- 0006_directory_search.sql  –  EquipSync  –  Institution Search & Security
-- Revokes raw view access to prevent underlying table permission denials.
-- Introduces a secure, throttled SECURITY DEFINER search function.
-- =============================================================================

-- 1. Revoke privileges on institution_directory view
revoke all on public.institution_directory from anon, authenticated, public;

-- 2. Create search_institutions function (SECURITY DEFINER)
create or replace function public.search_institutions(p_query text)
returns table (
  id uuid,
  name text,
  type text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q text;
begin
  v_q := trim(coalesce(p_query, ''));

  if length(v_q) < 3 then
    raise exception 'query_too_short';
  end if;

  return query
  select i.id, i.name, i.type
  from public.institutions i
  where i.name ilike ('%' || v_q || '%')
  order by
    case when i.name ilike (v_q || '%') then 0 else 1 end,
    i.name asc
  limit 8;
end;
$$;

-- 3. Manage execution grants
revoke execute on function public.search_institutions(text) from public;
grant execute on function public.search_institutions(text) to anon, authenticated;
