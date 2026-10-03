// Runs the Supabase migrations in an in-process Postgres (PGlite) with a stub of
// Supabase's auth schema and API roles, then checks RLS and the sale/stock functions.
import { before, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import type { SalesReport } from "../lib/database.types";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";

// Mirrors what Supabase provides before any project migration runs, including the
// cloud default privileges, so the migration's explicit revokes are exercised.
const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    created_at timestamptz not null default now(),
    email_confirmed_at timestamptz,
    last_sign_in_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

let db: PGlite;
type Row = Record<string, unknown>;
type Query = (sql: string, params?: unknown[]) => Promise<Row[]>;

/** Runs fn as an API request would: one transaction, as `user` (null = anon). */
function as<T>(user: string | null, fn: (q: Query) => Promise<T>): Promise<T> {
  return db.transaction(async (tx: Transaction) => {
    await tx.exec(`set local role ${user ? "authenticated" : "anon"}`);
    if (user) await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user]);
    return fn(async (sql, params) => (await tx.query<Row>(sql, params)).rows);
  });
}

/** Runs fn as the server-side service role (what the PayMongo webhook uses). */
function asService<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  return db.transaction(async (tx: Transaction) => {
    await tx.exec(`set local role service_role`);
    return fn(async (sql, params) => (await tx.query<Row>(sql, params)).rows);
  });
}

const one = async (p: Promise<Row[]>) => (await p)[0];
const sell = (user: string, saleId: string, items: unknown, method = "cash", discount = 0, expected: number | null = null) =>
  as(user, (q) =>
    one(q(`select * from complete_sale($1, $2::jsonb, $3, $4, $5)`, [saleId, JSON.stringify(items), method, discount, expected])),
  );
const stockOf = async (id: string) =>
  Number((await one(as(A, (q) => q(`select stock_quantity from products where id = $1`, [id])))).stock_quantity);
const countSales = async () =>
  Number((await one(as(A, (q) => q(`select count(*)::int as n from sales`)))).n);

let coffee: string;
let bread: string;
let saleId: string;

before(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(process.cwd(), "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  await db.query(`insert into auth.users (id, email) values ($1, 'a@test.local'), ($2, 'b@test.local')`, [A, B]);

  await as(A, (q) =>
    q(`insert into profiles (user_id, business_name, tax_rate, timezone) values ($1, 'A Store', 12, 'Asia/Manila')`, [A]),
  );
  await as(B, (q) => q(`insert into profiles (user_id, business_name) values ($1, 'B Store')`, [B]));
  const drinks = await one(as(A, (q) => q(`insert into categories (name) values ('Drinks') returning id`)));
  coffee = (await one(
    as(A, (q) =>
      q(`insert into products (name, sku, category_id, price, cost, stock_quantity, low_stock_threshold)
         values ('Coffee', 'CF-1', $1, 50, 20, 10, 3) returning id`, [drinks.id]),
    ),
  )).id as string;
  bread = (await one(
    as(A, (q) => q(`insert into products (name, price, cost, stock_quantity) values ('Bread', 25.50, 10, 3) returning id`)),
  )).id as string;
});

test("rows are isolated per user", async () => {
  assert.equal((await as(B, (q) => q(`select * from products`))).length, 0);
  assert.equal((await as(B, (q) => q(`select * from categories`))).length, 0);
  assert.equal((await as(B, (q) => q(`select * from profiles`))).length, 1);
  assert.equal((await as(B, (q) => q(`update products set name = 'hacked' returning id`))).length, 0);
  assert.equal((await as(B, (q) => q(`delete from products returning id`))).length, 0);
  await assert.rejects(
    as(B, (q) => q(`insert into categories (user_id, name) values ($1, 'Mine now')`, [A])),
    /row-level security/,
  );
});

test("anonymous requests get nothing", async () => {
  await assert.rejects(as(null, (q) => q(`select * from products`)), /permission denied/);
  await assert.rejects(as(null, (q) => q(`select * from sales`)), /permission denied/);
  await assert.rejects(
    as(null, (q) => q(`select complete_sale(gen_random_uuid(), '[]'::jsonb, 'cash', 0)`)),
    /permission denied/,
  );
});

test("a product can't point at another user's category", async () => {
  const other = await one(as(B, (q) => q(`insert into categories (name) values ('Snacks') returning id`)));
  await assert.rejects(
    as(A, (q) => q(`insert into products (name, price, category_id) values ('Chips', 1, $1)`, [other.id])),
    /foreign key/,
  );
});

test("every account gets a 60-day trial that owners can't change", async () => {
  const days = await one(as(A, (q) => q(`select extract(day from trial_ends_at - created_at)::int as d from profiles`)));
  assert.equal(days.d, 60);
  await assert.rejects(as(A, (q) => q(`update profiles set trial_ends_at = now() + interval '10 years'`)), /permission denied/);

  const C = "00000000-0000-4000-8000-00000000000c";
  await db.query(`insert into auth.users (id, email) values ($1, 'c@test.local')`, [C]);
  await assert.rejects(
    as(C, (q) => q(`insert into profiles (user_id, trial_ends_at) values ($1, now() + interval '10 years')`, [C])),
    /permission denied/,
  );
  await assert.rejects(
    as(C, (q) => q(`insert into profiles (user_id, created_at) values ($1, now() + interval '10 years')`, [C])),
    /permission denied/,
  );
  await as(C, (q) => q(`insert into profiles (user_id, business_name, timezone) values ($1, 'C Store', 'UTC')`, [C]));
  // A moment after creation: 60 days minus however long that took (0 when PGlite's clock hasn't ticked).
  const c = await one(
    as(C, (q) => q(`select trial_ends_at - now() between interval '59 days 23 hours' and interval '60 days' as ok from profiles`)),
  );
  assert.equal(c.ok, true);
});

test("stock and receipt counters can't be edited directly", async () => {
  await assert.rejects(as(A, (q) => q(`update products set stock_quantity = 999 where id = $1`, [coffee])), /permission denied/);
  await assert.rejects(as(A, (q) => q(`update profiles set last_receipt_number = 0`)), /permission denied/);
  const moves = await as(A, (q) => q(`select type, quantity, notes from inventory_movements where product_id = $1`, [coffee]));
  assert.deepEqual(moves, [{ type: "RESTOCK", quantity: 10, notes: "Opening stock" }]);
});

test("complete_sale records the sale, items, movements and stock in one go", async () => {
  saleId = crypto.randomUUID();
  const items = [
    { product_id: coffee, quantity: 2 },
    { product_id: bread, quantity: 1 },
    { product_id: coffee, quantity: 1 }, // duplicate lines are merged
  ];
  const sale = await sell(A, saleId, items, "cash", 10);
  // subtotal 3*50 + 25.50 = 175.50; less 10 = 165.50; 12% tax = 19.86
  assert.equal(sale.receipt_number, "R-000001");
  assert.equal(Number(sale.subtotal), 175.5);
  assert.equal(Number(sale.discount), 10);
  assert.equal(Number(sale.tax), 19.86);
  assert.equal(Number(sale.total), 185.36);
  assert.equal(sale.status, "completed");

  const lines = await as(A, (q) =>
    q(`select product_name, quantity, unit_price::float, unit_cost::float, subtotal::float
       from sale_items where sale_id = $1 order by product_name`, [saleId]),
  );
  assert.deepEqual(lines, [
    { product_name: "Bread", quantity: 1, unit_price: 25.5, unit_cost: 10, subtotal: 25.5 },
    { product_name: "Coffee", quantity: 3, unit_price: 50, unit_cost: 20, subtotal: 150 },
  ]);
  assert.equal(await stockOf(coffee), 7);
  assert.equal(await stockOf(bread), 2);
  const moves = await as(A, (q) =>
    q(`select quantity from inventory_movements where type = 'SALE' and reference_id = $1 order by quantity`, [saleId]),
  );
  assert.deepEqual(moves, [{ quantity: -3 }, { quantity: -1 }]);
});

test("retrying the same checkout doesn't sell twice", async () => {
  const again = await sell(A, saleId, [{ product_id: coffee, quantity: 5 }]);
  assert.equal(again.receipt_number, "R-000001");
  assert.equal(await countSales(), 1);
  assert.equal(await stockOf(coffee), 7);
});

test("a sale is refused when prices changed after the register loaded", async () => {
  // Register still shows the old coffee price (50): 1 x 50 + 12% = 56. Current price is also 50,
  // so the matching total goes through the check; a stale total is rejected with nothing written.
  await assert.rejects(
    sell(A, crypto.randomUUID(), [{ product_id: coffee, quantity: 1 }], "card", 0, 44.8),
    /Prices or tax changed since the register loaded. This sale now totals PHP 56.00/,
  );
  assert.equal(await countSales(), 1);
  assert.equal(await stockOf(coffee), 7);
});

test("a failed sale writes nothing", async () => {
  await assert.rejects(
    sell(A, crypto.randomUUID(), [{ product_id: coffee, quantity: 1 }, { product_id: bread, quantity: 5 }]),
    /Not enough stock for Bread: 2 left, 5 in cart/,
  );
  assert.equal(await countSales(), 1);
  assert.equal(await stockOf(coffee), 7);
  assert.equal(await stockOf(bread), 2);
  const profile = await one(as(A, (q) => q(`select last_receipt_number from profiles`)));
  assert.equal(profile.last_receipt_number, 1);
});

test("complete_sale rejects bad input", async () => {
  const id = () => crypto.randomUUID();
  const line = [{ product_id: coffee, quantity: 1 }];
  await assert.rejects(sell(A, id(), []), /cart is empty/);
  await assert.rejects(sell(A, id(), [{ product_id: coffee, quantity: 0 }]), /quantity between 1 and 10000/);
  await assert.rejects(sell(A, id(), line, "bitcoin"), /payment method/);
  await assert.rejects(sell(A, id(), line, "cash", 51), /Discount must be between 0 and the subtotal/);
  await assert.rejects(sell(A, id(), line, "cash", -1), /Discount must be between 0 and the subtotal/);
  await assert.rejects(sell(B, id(), line), /no longer exists/); // B can't sell A's stock
  await assert.rejects(sell(A, null as unknown as string, line), /Missing sale id/);
});

test("sales history is read-only through the API", async () => {
  await assert.rejects(
    as(A, (q) => q(`insert into sales (user_id, receipt_number, subtotal, total, payment_method) values ($1, 'X', 0, 0, 'cash')`, [A])),
    /permission denied/,
  );
  await assert.rejects(as(A, (q) => q(`update sales set total = 0`)), /permission denied/);
  await assert.rejects(as(A, (q) => q(`delete from sale_items`)), /permission denied/);
  await assert.rejects(
    as(A, (q) => q(`insert into inventory_movements (user_id, product_id, type, quantity) values ($1, $2, 'RESTOCK', 5)`, [A, coffee])),
    /permission denied/,
  );
});

test("editing a product doesn't change past sales", async () => {
  await as(A, (q) => q(`update products set name = 'Latte', price = 99, cost = 40 where id = $1`, [coffee]));
  const line = await one(as(A, (q) => q(`select product_name, unit_price::float from sale_items where product_id = $1`, [coffee])));
  assert.deepEqual(line, { product_name: "Coffee", unit_price: 50 });
  const sale = await one(as(A, (q) => q(`select total::float from sales where id = $1`, [saleId])));
  assert.equal(sale.total, 185.36);
});

test("archived products can't be sold; sold products can't be deleted", async () => {
  await assert.rejects(as(A, (q) => q(`delete from products where id = $1`, [coffee])), /foreign key/);
  await as(A, (q) => q(`update products set is_active = false where id = $1`, [coffee]));
  await assert.rejects(sell(A, crypto.randomUUID(), [{ product_id: coffee, quantity: 1 }]), /archived/);
  await as(A, (q) => q(`update products set is_active = true where id = $1`, [coffee]));

  const spare = await one(as(A, (q) => q(`insert into products (name, price, stock_quantity) values ('Spare', 1, 4) returning id`)));
  await as(A, (q) => q(`delete from products where id = $1`, [spare.id]));
  const left = await as(A, (q) => q(`select id from inventory_movements where product_id = $1`, [spare.id]));
  assert.equal(left.length, 0);
});

test("adjust_stock restocks, sets counts and logs every change", async () => {
  const restocked = await one(as(A, (q) => q(`select * from adjust_stock($1, 'RESTOCK', 10, 'Supplier delivery')`, [bread])));
  assert.equal(restocked.stock_quantity, 12);
  const counted = await one(as(A, (q) => q(`select * from adjust_stock($1, 'ADJUSTMENT', 11, 'Shelf count')`, [bread])));
  assert.equal(counted.stock_quantity, 11);
  const moves = await as(A, (q) =>
    q(`select type, quantity, notes from inventory_movements where product_id = $1 and type <> 'SALE' order by created_at, quantity`, [bread]),
  );
  assert.deepEqual(moves.slice(-2), [
    { type: "RESTOCK", quantity: 10, notes: "Supplier delivery" },
    { type: "ADJUSTMENT", quantity: -1, notes: "Shelf count" },
  ]);
  await assert.rejects(as(A, (q) => q(`select adjust_stock($1, 'ADJUSTMENT', 11)`, [bread])), /already 11/);
  await assert.rejects(as(A, (q) => q(`select adjust_stock($1, 'ADJUSTMENT', -1)`, [bread])), /between 0 and/);
  await assert.rejects(as(A, (q) => q(`select adjust_stock($1, 'RESTOCK', 0)`, [bread])), /between 1 and/);
  await assert.rejects(as(B, (q) => q(`select adjust_stock($1, 'RESTOCK', 5)`, [bread])), /Product not found/);
});

test("low stock flag follows the threshold", async () => {
  const rows = await as(A, (q) => q(`select name, is_low_stock from products where is_active order by name`));
  assert.deepEqual(rows, [
    { name: "Bread", is_low_stock: false }, // 11 left, threshold 5
    { name: "Latte", is_low_stock: false }, // 7 left, threshold 3
  ]);
  await sell(A, crypto.randomUUID(), [{ product_id: coffee, quantity: 4 }], "gcash");
  const latte = await one(as(A, (q) => q(`select stock_quantity, is_low_stock from products where id = $1`, [coffee])));
  assert.deepEqual(latte, { stock_quantity: 3, is_low_stock: true });
});

test("sales_report sums the period in the business timezone", async () => {
  const today = (await one(as(A, (q) => q(`select sales_report('today') as r`)))).r as SalesReport;
  // Sale 1: 185.36 (cost 70, net 165.50). Sale 2: 4 x 99 = 396 + 12% = 443.52 (cost 160, net 396).
  assert.equal(today.transactions, 2);
  assert.equal(today.revenue, 628.88);
  assert.equal(today.cost, 230);
  assert.equal(today.net_sales, 561.5);
  assert.equal(today.profit, 331.5);
  assert.equal(today.average, 314.44);
  assert.equal(today.items_sold, 8);
  assert.equal(today.timezone, "Asia/Manila");
  assert.equal(today.series.length, 24);
  const bucketed = today.series.reduce((sum, b) => sum + b.revenue, 0);
  assert.ok(Math.abs(bucketed - 628.88) < 1e-9);
  assert.deepEqual(today.by_payment.map((p) => p.method), ["gcash", "cash"]);
  // Grouped by product, named after its most recent sale (Coffee was renamed Latte).
  assert.deepEqual(
    today.top_products.map((p) => [p.name, p.quantity]),
    [["Latte", 7], ["Bread", 1]],
  );

  for (const [period, buckets] of [["7d", 7], ["week", 7]] as const) {
    const r = (await one(as(A, (q) => q(`select sales_report($1) as r`, [period])))).r as { series: unknown[]; transactions: number };
    assert.equal(r.series.length, buckets);
    assert.equal(r.transactions, 2);
  }
  const month = (await one(as(A, (q) => q(`select sales_report('month') as r`)))).r as { series: unknown[] };
  assert.ok(month.series.length >= 28 && month.series.length <= 31);

  const other = (await one(as(B, (q) => q(`select sales_report('today') as r`)))).r as { transactions: number; revenue: number };
  assert.deepEqual([other.transactions, other.revenue], [0, 0]);
  await assert.rejects(as(A, (q) => q(`select sales_report('decade')`)), /Unknown report period/);
});

test("a lapsed account is locked until KASSIX Pro is paid", async () => {
  const D = "00000000-0000-4000-8000-00000000000d";
  await db.query(`insert into auth.users (id, email) values ($1, 'd@test.local')`, [D]);
  await as(D, (q) => q(`insert into profiles (user_id, business_name) values ($1, 'D Store')`, [D]));
  const soap = await one(as(D, (q) => q(`insert into products (name, price, stock_quantity) values ('Soap', 20, 5) returning id`)));
  assert.equal((await one(as(D, (q) => q(`select has_access() as ok`)))).ok, true);
  const soapSale = crypto.randomUUID();
  await sell(D, soapSale, [{ product_id: soap.id, quantity: 1 }]);

  // Trial runs out.
  await db.query(`update profiles set trial_ends_at = now() - interval '1 day' where user_id = $1`, [D]);
  assert.equal((await one(as(D, (q) => q(`select has_access() as ok`)))).ok, false);
  assert.equal((await as(D, (q) => q(`select * from products`))).length, 0);
  await assert.rejects(as(D, (q) => q(`insert into categories (name) values ('X')`)), /row-level security/);
  await assert.rejects(
    as(D, (q) => q(`select * from complete_sale($1, $2::jsonb, 'cash', 0)`, [crypto.randomUUID(), JSON.stringify([{ product_id: soap.id, quantity: 1 }])])),
    /trial has ended/,
  );
  await assert.rejects(as(D, (q) => q(`select adjust_stock($1, 'RESTOCK', 1)`, [soap.id])), /trial has ended/);
  await assert.rejects(as(D, (q) => q(`select void_sale($1, 'mistake')`, [soapSale])), /trial has ended/);

  // Owners can't grant themselves time; only the webhook's service role can record payments.
  await assert.rejects(
    as(D, (q) => q(`select record_payment($1, 'monthly', 149, 'cs_fake')`, [D])),
    /permission denied/,
  );

  // A monthly payment unlocks 30 days from now, once per checkout session.
  const paid = await one(asService((q) => q(`select * from record_payment($1, 'monthly', 149, 'cs_test_1', 'pay_1', 'gcash')`, [D])));
  const again = await one(asService((q) => q(`select * from record_payment($1, 'monthly', 149, 'cs_test_1', 'pay_1', 'gcash')`, [D])));
  assert.deepEqual(again.paid_until, paid.paid_until);
  const days = await one(as(D, (q) => q(`select round(extract(epoch from paid_until - now()) / 86400) as d from profiles`)));
  assert.equal(Number(days.d), 30);
  assert.equal((await one(as(D, (q) => q(`select has_access() as ok`)))).ok, true);
  assert.equal((await as(D, (q) => q(`select * from products`))).length, 1);
  const history = await as(D, (q) => q(`select plan, amount::float, method from payments`));
  assert.deepEqual(history, [{ plan: "monthly", amount: 149, method: "gcash" }]);
  assert.equal((await as(A, (q) => q(`select * from payments`))).length, 0); // private to D
});

test("paying during the trial adds the time after the trial", async () => {
  const before = await one(as(A, (q) => q(`select trial_ends_at from profiles`)));
  const after = await one(asService((q) => q(`select * from record_payment($1, 'yearly', 1490, 'cs_test_2')`, [A])));
  const gap = (Date.parse(String(after.paid_until)) - Date.parse(String(before.trial_ends_at))) / 86_400_000;
  assert.equal(Math.round(gap), 365);
});

test("voiding a sale puts its items back, logs why, and drops it from reports", async () => {
  const report = async () => (await one(as(A, (q) => q(`select sales_report('today') as r`)))).r as SalesReport;
  const tea = (await one(as(A, (q) => q(`insert into products (name, price, cost, stock_quantity) values ('Tea', 10, 4, 5) returning id`)))).id as string;
  const before = await report();
  const saleId = crypto.randomUUID();
  const sale = await sell(A, saleId, [{ product_id: tea, quantity: 2 }], "cash");
  assert.equal(await stockOf(tea), 3);
  assert.equal((await report()).transactions, before.transactions + 1);

  // The owner has to say why; other accounts and signed-out callers can't void it.
  await assert.rejects(as(A, (q) => q(`select void_sale($1, '  ')`, [saleId])), /Say why/);
  await assert.rejects(as(A, (q) => q(`select void_sale($1, $2)`, [saleId, "x".repeat(151)])), /Say why/);
  await assert.rejects(as(B, (q) => q(`select void_sale($1, 'mistake')`, [saleId])), /doesn't exist/);
  await assert.rejects(as(null, (q) => q(`select void_sale($1, 'mistake')`, [saleId])), /permission denied/);

  const voided = await one(as(A, (q) => q(`select * from void_sale($1, ' Rang up twice ')`, [saleId])));
  assert.equal(voided.status, "voided");
  assert.equal(voided.void_reason, "Rang up twice");
  assert.ok(voided.voided_at);
  assert.equal(await stockOf(tea), 5);
  const voidMoves = () =>
    as(A, (q) => q(`select type, quantity, notes from inventory_movements where reference_id = $1 and type = 'VOID'`, [saleId]));
  assert.deepEqual(await voidMoves(), [{ type: "VOID", quantity: 2, notes: `Void of ${sale.receipt_number}: Rang up twice` }]);

  // Voiding again changes nothing.
  assert.equal((await one(as(A, (q) => q(`select * from void_sale($1, 'again')`, [saleId])))).void_reason, "Rang up twice");
  assert.equal(await stockOf(tea), 5);
  assert.equal((await voidMoves()).length, 1);

  // Reports count completed sales only; the history keeps the voided sale and its receipt number.
  const after = await report();
  assert.deepEqual([after.transactions, after.revenue], [before.transactions, before.revenue]);
  assert.equal((await one(as(A, (q) => q(`select status from sales where id = $1`, [saleId])))).status, "voided");
  await assert.rejects(as(A, (q) => q(`update sales set status = 'completed' where id = $1`, [saleId])), /permission denied/);
});

test("each owner picks their own appearance", async () => {
  const theme = async (user: string) => (await one(as(user, (q) => q(`select ui_theme from profiles`)))).ui_theme;
  assert.equal(await theme(A), "classic");
  await as(A, (q) => q(`update profiles set ui_theme = 'dark'`));
  assert.equal(await theme(A), "dark");
  assert.equal(await theme(B), "classic");
  await assert.rejects(as(A, (q) => q(`update profiles set ui_theme = 'pink'`)), /check constraint/);
  await as(A, (q) => q(`update profiles set ui_theme = 'classic'`));
});

test("only admins see every account, and owners can't make themselves admin", async () => {
  await assert.rejects(as(A, (q) => q(`select * from admin_accounts()`)), /Not allowed/);
  await assert.rejects(as(null, (q) => q(`select * from admin_accounts()`)), /permission denied/);
  await assert.rejects(as(A, (q) => q(`update profiles set is_admin = true`)), /permission denied/);

  // Someone who signed up but never opened KASSIX: no profile yet, so the sign-up details show.
  const E = "00000000-0000-4000-8000-00000000000e";
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, 'e@test.local', $2)`, [
    E,
    JSON.stringify({ business_name: "E Store", owner_name: "Eve" }),
  ]);
  await db.query(`update profiles set is_admin = true where user_id = $1`, [A]);
  const rows = await as(A, (q) => q(`select * from admin_accounts()`));
  const row = (id: string) => rows.find((r) => r.user_id === id)!;
  assert.equal(rows.length, Number((await db.query<Row>(`select count(*)::int as n from auth.users`)).rows[0].n));
  assert.equal(rows[0].user_id, E); // newest first
  assert.deepEqual([row(E).business_name, row(E).owner_name, row(E).trial_ends_at, Number(row(E).sales)], ["E Store", "Eve", null, 0]);

  const counts = (await db.query<Row>(
    `select (select count(*) from sales where user_id = $1 and status = 'completed')::int as sales,
            (select count(*) from products where user_id = $1)::int as products`,
    [A],
  )).rows[0];
  assert.deepEqual([row(A).email, row(A).business_name, Number(row(A).sales), Number(row(A).products)], [
    "a@test.local",
    "A Store",
    counts.sales,
    counts.products,
  ]);
  assert.ok(row(A).last_sale_at);
  assert.equal(row(A).last_plan, "yearly"); // the payment recorded earlier
  assert.equal(row(B).last_plan, null);
  await assert.rejects(as(B, (q) => q(`select * from admin_accounts()`)), /Not allowed/);

  // Revenue counts customers' payments (D's ₱149) but not the admin's own (A's ₱1,490 test).
  const revenue = await one(as(A, (q) => q(`select revenue::float, payments::int, paying_accounts::int from admin_revenue()`)));
  assert.deepEqual(revenue, { revenue: 149, payments: 1, paying_accounts: 1 });
  await assert.rejects(as(B, (q) => q(`select * from admin_revenue()`)), /Not allowed/);
});
