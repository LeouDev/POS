-- The KASSIX operator's overview of every account (the /admin page). An account becomes an admin
-- in the SQL editor:
--   update public.profiles set is_admin = true
--   where user_id = (select id from auth.users where email = 'you@example.com');
-- Owners can't set it themselves: profile updates are limited to the columns granted in earlier migrations.
alter table public.profiles add column is_admin boolean not null default false;

-- One row per registered account, newest first: who they are, their plan, and how much they use KASSIX
-- (counts only, never the records themselves). Accounts that haven't opened KASSIX yet have no profile,
-- so their names come from what they gave at sign-up.
-- ponytail: one pass over every account; page it once there are thousands.
create function public.admin_accounts()
returns table (
  user_id uuid,
  email text,
  signed_up_at timestamptz,
  confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  business_name text,
  owner_name text,
  profile_created_at timestamptz,
  trial_ends_at timestamptz,
  paid_until timestamptz,
  last_plan text,
  products bigint,
  sales bigint,
  sales_7d bigint,
  sales_30d bigint,
  last_sale_at timestamptz
)
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
  select
    u.id,
    u.email::text,
    u.created_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    coalesce(p.business_name, u.raw_user_meta_data ->> 'business_name'),
    coalesce(p.owner_name, u.raw_user_meta_data ->> 'owner_name'),
    p.created_at,
    p.trial_ends_at,
    p.paid_until,
    (select pay.plan from public.payments pay where pay.user_id = u.id order by pay.paid_at desc limit 1),
    (select count(*) from public.products pr where pr.user_id = u.id),
    s.sales,
    s.sales_7d,
    s.sales_30d,
    s.last_sale_at
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  cross join lateral (
    select
      count(*) as sales,
      count(*) filter (where sa.created_at > now() - interval '7 days') as sales_7d,
      count(*) filter (where sa.created_at > now() - interval '30 days') as sales_30d,
      max(sa.created_at) as last_sale_at
    from public.sales sa
    where sa.user_id = u.id and sa.status = 'completed'
  ) s
  order by u.created_at desc;
end;
$$;

revoke execute on function public.admin_accounts() from public, anon;
grant execute on function public.admin_accounts() to authenticated;
