import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../lib/actions";
import { cartTotals, quickCashAmounts } from "../lib/cart";
import { addDays, zonedDayStart } from "../lib/dates";

test("cart totals match complete_sale's rounding", () => {
  // Same numbers as the database test: 3 x 50 + 25.50, less 10, 12% tax.
  const t = cartTotals([{ price: 50, quantity: 3 }, { price: 25.5, quantity: 1 }], 10, 12);
  assert.deepEqual(t, { subtotal: 175.5, discount: 10, tax: 19.86, total: 185.36 });

  // Half-cent tax rounds up, like Postgres round(numeric, 2).
  assert.equal(cartTotals([{ price: 0.25, quantity: 1 }], 0, 10).tax, 0.03);
  // Float-unfriendly prices stay exact in cents.
  assert.equal(cartTotals([{ price: 0.1, quantity: 3 }], 0, 0).total, 0.3);
  assert.equal(cartTotals([{ price: 19.99, quantity: 3 }], 0, 7.25).tax, 4.35);

  assert.equal(cartTotals([], 0, 12).total, 0);
});

test("quick cash buttons offer exact change and the next notes up", () => {
  assert.deepEqual(quickCashAmounts(187.36), [187.36, 200, 500, 1000]);
  assert.deepEqual(quickCashAmounts(200), [200, 500, 1000]);
  assert.deepEqual(quickCashAmounts(145.6), [145.6, 150, 160, 200]);
});

test("calendar days start at local midnight in the shop's timezone", () => {
  assert.equal(zonedDayStart("2026-09-29", "Asia/Manila").toISOString(), "2026-09-28T16:00:00.000Z");
  assert.equal(zonedDayStart("2026-09-29", "UTC").toISOString(), "2026-09-29T00:00:00.000Z");
  // DST starts at 2am on 2026-03-08 in New York; midnight is still EST (UTC-5).
  assert.equal(zonedDayStart("2026-03-08", "America/New_York").toISOString(), "2026-03-08T05:00:00.000Z");
  assert.equal(zonedDayStart("2026-03-09", "America/New_York").toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
});

test("redirect targets stay on this site", () => {
  assert.equal(safeNext("/sales?page=2"), "/sales?page=2");
  assert.equal(safeNext("//evil.example"), "/dashboard");
  assert.equal(safeNext("/\\evil.example"), "/dashboard");
  assert.equal(safeNext("https://evil.example"), "/dashboard");
  assert.equal(safeNext(undefined), "/dashboard");
});
