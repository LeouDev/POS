-- Voiding a sale recorded by mistake. The sale stays in history (status 'voided', with when and why),
-- its items go back into stock with one VOID movement per product, and sales_report already counts
-- only completed sales. Receipt numbers are never reused.

alter table public.sales
  add column voided_at timestamptz,
  add column void_reason text check (void_reason is null or char_length(void_reason) between 1 and 150);

alter table public.inventory_movements drop constraint inventory_movements_type_check;
-- The sign rule was created unnamed, so Postgres called it inventory_movements_check.
alter table public.inventory_movements drop constraint inventory_movements_check;
alter table public.inventory_movements
  add constraint inventory_movements_type_check check (type in ('SALE', 'RESTOCK', 'ADJUSTMENT', 'VOID')),
  add constraint inventory_movements_quantity_check check (
    (type = 'SALE' and quantity < 0)
    or (type in ('RESTOCK', 'VOID') and quantity > 0)
    or (type = 'ADJUSTMENT' and quantity <> 0)
  );

create function public.void_sale(p_sale_id uuid, p_reason text) returns public.sales
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_sale public.sales;
begin
  if v_user is null then
    raise exception 'Sign in to void a sale.' using errcode = '28000';
  end if;
  if v_reason = '' or char_length(v_reason) > 150 then
    raise exception 'Say why you''re voiding this sale (up to 150 characters).';
  end if;

  -- Same lock as complete_sale, so a void can't interleave with a retried checkout of this sale.
  perform pg_advisory_xact_lock(hashtextextended(p_sale_id::text, 0));
  select * into v_sale from public.sales where id = p_sale_id and user_id = v_user for update;
  if not found then
    raise exception 'That sale doesn''t exist.';
  end if;
  if v_sale.status = 'voided' then
    return v_sale; -- already voided: nothing more to put back
  end if;

  -- Lock the products in id order, like complete_sale, then return the items to stock.
  perform 1 from public.products p
  where p.id in (select product_id from public.sale_items where sale_id = p_sale_id)
  order by p.id
  for update;

  update public.products p set stock_quantity = p.stock_quantity + i.quantity
  from (
    select product_id, sum(quantity)::integer as quantity from public.sale_items where sale_id = p_sale_id group by product_id
  ) i
  where p.id = i.product_id and p.user_id = v_user;

  insert into public.inventory_movements (user_id, product_id, type, quantity, reference_id, notes)
  select v_user, product_id, 'VOID', sum(quantity)::integer, p_sale_id, 'Void of ' || v_sale.receipt_number || ': ' || v_reason
  from public.sale_items where sale_id = p_sale_id
  group by product_id;

  update public.sales set status = 'voided', voided_at = now(), void_reason = v_reason
  where id = p_sale_id
  returning * into v_sale;
  return v_sale;
end;
$$;

revoke execute on function public.void_sale(uuid, text) from public, anon;
grant execute on function public.void_sale(uuid, text) to authenticated;
