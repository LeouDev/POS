-- KASSIX Pro: after the free trial, an account keeps access only while it has paid time left.
-- Access lasts until the later of trial_ends_at and paid_until. Payments come in through the
-- PayMongo webhook (service role) via record_payment(); owners can read their payment history
-- but never write it. A lapsed account's data stays intact and reappears once it pays.

alter table public.profiles add column paid_until timestamptz;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('monthly', 'yearly')),
  amount numeric(12, 2) not null check (amount > 0),
  checkout_session_id text not null unique,
  payment_id text,
  method text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  paid_at timestamptz not null default now()
);
create index payments_user_paid_idx on public.payments (user_id, paid_at desc);

alter table public.payments enable row level security;
create policy "Own payments" on public.payments for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;

-- ---------------------------------------------------------------------------
-- Access checks
-- ---------------------------------------------------------------------------

create function public.account_active(p_user uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select now() < greatest(p.trial_ends_at, coalesce(p.paid_until, p.trial_ends_at))
    from public.profiles p
    where p.user_id = p_user
  ), false)
$$;

/** Whether the signed-in business may use KASSIX right now (in its trial or paid time). */
create function public.has_access() returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.account_active(auth.uid())
$$;

-- Business data is only readable and writable while the account is active.
alter policy "Own categories" on public.categories
  using (user_id = (select auth.uid()) and (select public.has_access()))
  with check (user_id = (select auth.uid()) and (select public.has_access()));
alter policy "Own products" on public.products
  using (user_id = (select auth.uid()) and (select public.has_access()))
  with check (user_id = (select auth.uid()) and (select public.has_access()));
alter policy "Own sales" on public.sales
  using (user_id = (select auth.uid()) and (select public.has_access()));
alter policy "Own sale items" on public.sale_items
  using (
    (select public.has_access())
    and exists (select 1 from public.sales s where s.id = sale_id and s.user_id = (select auth.uid()))
  );
alter policy "Own inventory movements" on public.inventory_movements
  using (user_id = (select auth.uid()) and (select public.has_access()));

-- complete_sale and adjust_stock run with owner rights (no RLS), so guard their writes too.
create function public.require_active_account() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.account_active(new.user_id) then
    raise exception 'Your KASSIX trial has ended. Subscribe to KASSIX Pro to keep using KASSIX.';
  end if;
  return new;
end;
$$;

create trigger sales_require_active_account before insert on public.sales
  for each row execute function public.require_active_account();
create trigger inventory_movements_require_active_account before insert on public.inventory_movements
  for each row execute function public.require_active_account();

-- ---------------------------------------------------------------------------
-- record_payment: called by the PayMongo webhook with the service role.
-- Idempotent per checkout session, so retried webhooks never add time twice.
-- Time is added after whatever the account already has (trial or paid), so paying early
-- never loses days.
-- ---------------------------------------------------------------------------

create function public.record_payment(
  p_user_id uuid,
  p_plan text,
  p_amount numeric,
  p_checkout_session_id text,
  p_payment_id text default null,
  p_method text default null
) returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
  v_days integer;
  v_start timestamptz;
begin
  v_days := case p_plan when 'monthly' then 30 when 'yearly' then 365 end;
  if v_days is null then
    raise exception 'Unknown plan %', p_plan;
  end if;

  select * into v_profile from public.profiles where user_id = p_user_id for update;
  if not found then
    raise exception 'No KASSIX account for user %', p_user_id;
  end if;

  v_start := greatest(now(), v_profile.trial_ends_at, coalesce(v_profile.paid_until, now()));
  insert into public.payments (user_id, plan, amount, checkout_session_id, payment_id, method, period_start, period_end)
  values (p_user_id, p_plan, p_amount, p_checkout_session_id, p_payment_id, p_method, v_start, v_start + make_interval(days => v_days))
  on conflict (checkout_session_id) do nothing;

  if found then
    update public.profiles set paid_until = v_start + make_interval(days => v_days)
      where user_id = p_user_id
      returning * into v_profile;
  end if;
  return v_profile;
end;
$$;

revoke execute on function public.account_active(uuid) from public, anon, authenticated;
revoke execute on function public.has_access() from public, anon;
revoke execute on function public.require_active_account() from public, anon, authenticated;
revoke execute on function public.record_payment(uuid, text, numeric, text, text, text) from public, anon, authenticated;
grant execute on function public.has_access() to authenticated;
grant execute on function public.record_payment(uuid, text, numeric, text, text, text) to service_role;
