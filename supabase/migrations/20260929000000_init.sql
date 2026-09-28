-- KASSIX POS schema.
-- Every business row belongs to auth.uid(). Row Level Security enforces that for the
-- Data API; sales and stock changes only happen through the functions at the bottom,
-- each of which runs as one transaction (a failed sale writes nothing).

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique default auth.uid() references auth.users (id) on delete cascade,
  business_name text not null default 'My Store' check (char_length(trim(business_name)) between 1 and 100),
  owner_name text not null default '' check (char_length(owner_name) <= 100),
  currency text not null default 'PHP' check (currency ~ '^[A-Z]{3}$'),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate between 0 and 100),
  timezone text not null default 'UTC' check (char_length(timezone) between 1 and 64),
  last_receipt_number integer not null default 0 check (last_receipt_number >= 0),
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 50),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index categories_user_name_key on public.categories (user_id, lower(name));

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 100),
  sku text check (sku is null or char_length(sku) between 1 and 50),
  price numeric(12, 2) not null check (price >= 0),
  cost numeric(12, 2) not null default 0 check (cost >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  low_stock_threshold integer not null default 5 check (low_stock_threshold >= 0),
  is_low_stock boolean generated always as (stock_quantity <= low_stock_threshold) stored,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite key keeps a product from pointing at another user's category.
  foreign key (category_id, user_id) references public.categories (id, user_id) on delete set null (category_id)
);
create unique index products_user_sku_key on public.products (user_id, lower(sku)) where sku is not null;
create index products_user_name_idx on public.products (user_id, name);
create index products_category_idx on public.products (category_id);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  receipt_number text not null,
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) not null check (total >= 0),
  payment_method text not null check (payment_method in ('cash', 'card', 'gcash', 'other')),
  status text not null default 'completed' check (status in ('completed', 'voided')),
  created_at timestamptz not null default now(),
  unique (user_id, receipt_number)
);
create index sales_user_created_idx on public.sales (user_id, created_at desc);

-- product_name, unit_price and unit_cost are snapshots: editing a product later
-- never changes a recorded sale. The product FK blocks deleting sold products.
create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales (id) on delete cascade,
  product_id uuid not null references public.products (id),
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  subtotal numeric(12, 2) not null check (subtotal >= 0)
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (product_id);

-- Signed quantities: SALE is negative, RESTOCK positive, ADJUSTMENT either way.
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  type text not null check (type in ('SALE', 'RESTOCK', 'ADJUSTMENT')),
  quantity integer not null check (
    (type = 'SALE' and quantity < 0)
    or (type = 'RESTOCK' and quantity > 0)
    or (type = 'ADJUSTMENT' and quantity <> 0)
  ),
  reference_id uuid,
  notes text check (notes is null or char_length(notes) <= 200),
  created_at timestamptz not null default now()
);
create index inventory_movements_user_created_idx on public.inventory_movements (user_id, created_at desc);
create index inventory_movements_product_idx on public.inventory_movements (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security: users only ever see and change their own rows.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_movements enable row level security;

create policy "Own profile" on public.profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own categories" on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own products" on public.products for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Own sales" on public.sales for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Own sale items" on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and s.user_id = (select auth.uid())));
create policy "Own inventory movements" on public.inventory_movements for select to authenticated
  using (user_id = (select auth.uid()));

-- Explicit grants, so behaviour doesn't depend on the project's default privileges.
-- Stock levels and receipt counters are only writable through the functions below,
-- which keeps the inventory audit trail complete. Sales history is read-only.
revoke all on public.profiles, public.categories, public.products, public.sales,
  public.sale_items, public.inventory_movements from anon, authenticated;

grant select, insert on public.profiles to authenticated;
grant update (business_name, owner_name, currency, tax_rate, timezone) on public.profiles to authenticated;
grant select, insert, update, delete on public.categories to authenticated;
grant select, insert, delete on public.products to authenticated;
grant update (category_id, name, sku, price, cost, low_stock_threshold, is_active) on public.products to authenticated;
grant select on public.sales, public.sale_items, public.inventory_movements to authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function public.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger products_touch_updated_at before update on public.products
  for each row execute function public.touch_updated_at();

-- Opening stock entered on the product form is logged like any other restock.
create function public.log_opening_stock() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.inventory_movements (user_id, product_id, type, quantity, notes)
  values (new.user_id, new.id, 'RESTOCK', new.stock_quantity, 'Opening stock');
  return new;
end;
$$;

create trigger products_log_opening_stock after insert on public.products
  for each row when (new.stock_quantity > 0) execute function public.log_opening_stock();

-- ---------------------------------------------------------------------------
-- complete_sale: the whole checkout in one transaction.
-- p_items: [{"product_id": uuid, "quantity": int}, ...]
-- p_sale_id is generated by the client per checkout attempt, so a retried
-- request returns the sale it already recorded instead of charging twice.
-- Prices, costs, tax and totals are always computed here, never trusted from the client;
-- p_expected_total is the total the cashier saw, and the sale is refused if prices or
-- tax changed underneath it (e.g. edited on another device).
-- ---------------------------------------------------------------------------

create function public.complete_sale(
  p_sale_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_discount numeric default 0,
  p_expected_total numeric default null
) returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_sale public.sales;
  v_profile public.profiles;
  v_product public.products;
  v_lines jsonb;
  v_line record;
  v_subtotal numeric(12, 2) := 0;
  v_discount numeric(12, 2) := round(coalesce(p_discount, 0), 2);
  v_tax numeric(12, 2);
begin
  if v_user is null then
    raise exception 'You are signed out. Sign in again to record sales.' using errcode = '28000';
  end if;

  if p_sale_id is null then
    raise exception 'Missing sale id.';
  end if;

  -- A retry that arrives while the first attempt is still running waits for it here,
  -- then finds the finished sale below instead of failing on the duplicate id.
  perform pg_advisory_xact_lock(hashtextextended(p_sale_id::text, 0));

  select * into v_sale from public.sales where id = p_sale_id;
  if found then
    if v_sale.user_id <> v_user then
      raise exception 'Sale id already used' using errcode = '23505';
    end if;
    return v_sale;
  end if;

  if p_payment_method is null or p_payment_method not in ('cash', 'card', 'gcash', 'other') then
    raise exception 'Choose a payment method.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'The cart is empty.';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    where x.product_id is null or x.quantity is null or x.quantity < 1 or x.quantity > 10000
  ) then
    raise exception 'Every cart line needs a product and a quantity between 1 and 10000.';
  end if;

  -- Merge duplicate lines; sorted so concurrent sales lock rows in the same order.
  select jsonb_agg(jsonb_build_object('product_id', product_id, 'quantity', quantity) order by product_id)
    into v_lines
  from (
    select x.product_id, sum(x.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as x(product_id uuid, quantity integer)
    group by x.product_id
  ) merged;

  for v_line in select * from jsonb_to_recordset(v_lines) as l(product_id uuid, quantity integer) loop
    select * into v_product from public.products
      where id = v_line.product_id and user_id = v_user
      for update;
    if not found then
      raise exception 'A product in the cart no longer exists. Remove it and try again.';
    end if;
    if not v_product.is_active then
      raise exception '% is archived and can''t be sold.', v_product.name;
    end if;
    if v_product.stock_quantity < v_line.quantity then
      raise exception 'Not enough stock for %: % left, % in cart.',
        v_product.name, v_product.stock_quantity, v_line.quantity;
    end if;
    v_subtotal := v_subtotal + v_product.price * v_line.quantity;
  end loop;

  if v_discount < 0 or v_discount > v_subtotal then
    raise exception 'Discount must be between 0 and the subtotal.';
  end if;

  insert into public.profiles (user_id) values (v_user) on conflict (user_id) do nothing;
  update public.profiles set last_receipt_number = last_receipt_number + 1
    where user_id = v_user
    returning * into v_profile;

  v_tax := round((v_subtotal - v_discount) * v_profile.tax_rate / 100, 2);

  if p_expected_total is not null and round(p_expected_total, 2) <> v_subtotal - v_discount + v_tax then
    raise exception 'Prices or tax changed since the register loaded. This sale now totals % %. Check the cart and try again.',
      v_profile.currency, v_subtotal - v_discount + v_tax;
  end if;

  insert into public.sales (id, user_id, receipt_number, subtotal, discount, tax, total, payment_method)
  values (
    p_sale_id,
    v_user,
    'R-' || lpad(v_profile.last_receipt_number::text, greatest(6, length(v_profile.last_receipt_number::text)), '0'),
    v_subtotal,
    v_discount,
    v_tax,
    v_subtotal - v_discount + v_tax,
    p_payment_method
  )
  returning * into v_sale;

  insert into public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, subtotal)
  select v_sale.id, p.id, p.name, l.quantity, p.price, p.cost, p.price * l.quantity
  from jsonb_to_recordset(v_lines) as l(product_id uuid, quantity integer)
  join public.products p on p.id = l.product_id;

  update public.products p set stock_quantity = p.stock_quantity - l.quantity
  from jsonb_to_recordset(v_lines) as l(product_id uuid, quantity integer)
  where p.id = l.product_id;

  insert into public.inventory_movements (user_id, product_id, type, quantity, reference_id, notes)
  select v_user, l.product_id, 'SALE', -l.quantity, v_sale.id, 'Receipt ' || v_sale.receipt_number
  from jsonb_to_recordset(v_lines) as l(product_id uuid, quantity integer);

  return v_sale;
end;
$$;

-- ---------------------------------------------------------------------------
-- adjust_stock: RESTOCK adds p_quantity units; ADJUSTMENT sets the counted
-- stock to p_quantity. Either way the change is logged as a movement.
-- ---------------------------------------------------------------------------

create function public.adjust_stock(
  p_product_id uuid,
  p_type text,
  p_quantity integer,
  p_notes text default null
) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_product public.products;
  v_delta integer;
begin
  if v_user is null then
    raise exception 'You are signed out. Sign in again to change stock.' using errcode = '28000';
  end if;
  if p_type is null or p_type not in ('RESTOCK', 'ADJUSTMENT') then
    raise exception 'Unknown stock change type.';
  end if;
  if p_notes is not null and char_length(p_notes) > 200 then
    raise exception 'Notes can be at most 200 characters.';
  end if;

  select * into v_product from public.products
    where id = p_product_id and user_id = v_user
    for update;
  if not found then
    raise exception 'Product not found.';
  end if;

  if p_type = 'RESTOCK' then
    if p_quantity is null or p_quantity < 1 or p_quantity > 1000000 then
      raise exception 'Restock quantity must be between 1 and 1,000,000.';
    end if;
    v_delta := p_quantity;
  else
    if p_quantity is null or p_quantity < 0 or p_quantity > 1000000 then
      raise exception 'Counted stock must be between 0 and 1,000,000.';
    end if;
    v_delta := p_quantity - v_product.stock_quantity;
    if v_delta = 0 then
      raise exception 'Stock is already %.', p_quantity;
    end if;
  end if;

  update public.products set stock_quantity = stock_quantity + v_delta
    where id = p_product_id
    returning * into v_product;

  insert into public.inventory_movements (user_id, product_id, type, quantity, notes)
  values (v_user, p_product_id, p_type, v_delta, nullif(trim(p_notes), ''));

  return v_product;
end;
$$;

-- ---------------------------------------------------------------------------
-- sales_report: totals, payment mix, best sellers and a time series for a
-- period in the business's timezone. Runs as the caller, so RLS applies.
-- p_period: 'today' (hourly), '7d', 'week', 'month' (daily).
-- ---------------------------------------------------------------------------

create function public.sales_report(p_period text) returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_tz text;
  v_local_now timestamp;
  v_from timestamp;
  v_to timestamp;
  v_step interval := interval '1 day';
  v_unit text := 'day';
  v_result jsonb;
begin
  select p.timezone into v_tz from public.profiles p where p.user_id = v_user;
  begin
    v_local_now := now() at time zone coalesce(v_tz, 'UTC');
  exception when others then
    v_tz := null; -- unknown timezone name: fall back to UTC rather than failing
  end;
  v_tz := coalesce(v_tz, 'UTC');
  v_local_now := now() at time zone v_tz;

  case p_period
    when 'today' then
      v_from := date_trunc('day', v_local_now);
      v_to := v_from + interval '1 day';
      v_step := interval '1 hour';
      v_unit := 'hour';
    when '7d' then
      v_from := date_trunc('day', v_local_now) - interval '6 days';
      v_to := date_trunc('day', v_local_now) + interval '1 day';
    when 'week' then
      v_from := date_trunc('week', v_local_now);
      v_to := v_from + interval '7 days';
    when 'month' then
      v_from := date_trunc('month', v_local_now);
      v_to := v_from + interval '1 month';
    else
      raise exception 'Unknown report period: %', p_period;
  end case;

  with s as (
    select * from public.sales
    where user_id = v_user
      and status = 'completed'
      and created_at >= (v_from at time zone v_tz)
      and created_at < (v_to at time zone v_tz)
  ),
  items as (
    select si.*, s.created_at from public.sale_items si join s on s.id = si.sale_id
  ),
  totals as (
    select
      coalesce(sum(total), 0) as revenue,
      coalesce(sum(tax), 0) as tax,
      coalesce(sum(discount), 0) as discount,
      coalesce(sum(subtotal - discount), 0) as net_sales,
      count(*) as transactions
    from s
  ),
  costs as (
    select coalesce(sum(unit_cost * quantity), 0) as cost, coalesce(sum(quantity), 0) as items_sold from items
  )
  select jsonb_build_object(
    'period', p_period,
    'timezone', v_tz,
    'unit', v_unit,
    'from', v_from,
    'to', v_to,
    'revenue', t.revenue,
    'tax', t.tax,
    'discount', t.discount,
    'net_sales', t.net_sales,
    'cost', c.cost,
    'profit', t.net_sales - c.cost,
    'transactions', t.transactions,
    'items_sold', c.items_sold,
    'average', case when t.transactions = 0 then 0 else round(t.revenue / t.transactions, 2) end,
    'by_payment', coalesce((
      select jsonb_agg(jsonb_build_object('method', payment_method, 'total', total, 'count', n) order by total desc)
      from (select payment_method, sum(total) as total, count(*) as n from s group by payment_method) pm
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', product_id, 'name', name, 'quantity', quantity, 'revenue', revenue, 'profit', profit
      ) order by quantity desc, revenue desc)
      from (
        select
          product_id,
          (array_agg(product_name order by created_at desc))[1] as name,
          sum(quantity) as quantity,
          sum(subtotal) as revenue,
          sum(subtotal - unit_cost * quantity) as profit
        from items
        group by product_id
        order by sum(quantity) desc, sum(subtotal) desc
        limit 5
      ) tp
    ), '[]'::jsonb),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'at', b.at, 'revenue', coalesce(v.revenue, 0), 'transactions', coalesce(v.n, 0)
      ) order by b.at)
      from generate_series(v_from, v_to - v_step, v_step) as b(at)
      left join (
        select date_trunc(v_unit, created_at at time zone v_tz) as at, sum(total) as revenue, count(*) as n
        from s group by 1
      ) v on v.at = b.at
    )
  )
  into v_result
  from totals t, costs c;

  return v_result;
end;
$$;

revoke execute on function public.complete_sale(uuid, jsonb, text, numeric, numeric) from public, anon;
revoke execute on function public.adjust_stock(uuid, text, integer, text) from public, anon;
revoke execute on function public.sales_report(text) from public, anon;
revoke execute on function public.log_opening_stock() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;
grant execute on function public.complete_sale(uuid, jsonb, text, numeric, numeric) to authenticated;
grant execute on function public.adjust_stock(uuid, text, integer, text) to authenticated;
grant execute on function public.sales_report(text) to authenticated;
