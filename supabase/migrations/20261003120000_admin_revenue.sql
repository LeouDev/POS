-- KASSIX's own revenue for the /admin overview: KASSIX Pro payments received, gross (before PayMongo
-- fees and any refunds). Payments by admin accounts are left out: they are the operator's own tests.
create function public.admin_revenue()
returns table (revenue numeric, payments bigint, paying_accounts bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not coalesce((select p.is_admin from public.profiles p where p.user_id = auth.uid()), false) then
    raise exception 'Not allowed.' using errcode = '42501';
  end if;

  return query
  select coalesce(sum(pay.amount), 0), count(*), count(distinct pay.user_id)
  from public.payments pay
  where not exists (select 1 from public.profiles p where p.user_id = pay.user_id and p.is_admin);
end;
$$;

revoke execute on function public.admin_revenue() from public, anon;
grant execute on function public.admin_revenue() to authenticated;
