import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext } from "../lib/actions";
import { cartTotals, quickCashAmounts } from "../lib/cart";
import { addDays, zonedDayStart } from "../lib/dates";
import type { SalesReport } from "../lib/database.types";
import { chartPoints, describePeriod } from "../lib/format";
import { createHmac } from "node:crypto";
import { verifySignature } from "../lib/paymongo";
import { accessEndsAt, hasAccess, isPro, trialDaysLeft, trialEndsAt } from "../lib/trial";

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

test("report labels read the local bucket times as-is", () => {
  const base = { timezone: "Asia/Manila", revenue: 0, tax: 0, discount: 0, net_sales: 0, cost: 0, profit: 0,
    transactions: 0, items_sold: 0, average: 0, by_payment: [], top_products: [] };
  const today = { ...base, period: "today", unit: "hour", from: "2026-09-29T00:00:00", to: "2026-09-30T00:00:00",
    series: [{ at: "2026-09-29T00:00:00", revenue: 1, transactions: 1 }, { at: "2026-09-29T23:00:00", revenue: 2, transactions: 1 }] } as SalesReport;
  assert.deepEqual(chartPoints(today).map((p) => [p.label, p.title]), [["12am", "12am – 1am"], ["11pm", "11pm – 12am"]]);
  assert.equal(describePeriod(today), "Tuesday, September 29");

  const week = { ...today, period: "week", unit: "day", from: "2026-09-28T00:00:00", to: "2026-10-05T00:00:00",
    series: [{ at: "2026-09-28T00:00:00", revenue: 1, transactions: 1 }] } as SalesReport;
  assert.deepEqual(chartPoints(week).map((p) => [p.label, p.title]), [["Mon 28", "Mon, Sep 28"]]);
  assert.equal(describePeriod(week), "Mon, Sep 28 – Sun, Oct 4");
  assert.equal(describePeriod({ ...week, period: "month", from: "2026-09-01T00:00:00", to: "2026-10-01T00:00:00" }), "September 2026");
});

test("free trial: 60 days from sign-up, counted in whole days", () => {
  const created = "2026-09-29T02:00:00.000Z";
  // Before the free_trial migration the column is missing and the end is derived from created_at.
  const end = trialEndsAt({ created_at: created, trial_ends_at: undefined as unknown as string });
  assert.equal(end, "2026-11-28T02:00:00.000Z");
  assert.equal(trialEndsAt({ created_at: created, trial_ends_at: "2027-01-01T00:00:00.000Z" }), "2027-01-01T00:00:00.000Z");
  assert.equal(trialDaysLeft(end, Date.parse(created)), 60);
  assert.equal(trialDaysLeft(end, Date.parse("2026-11-27T03:00:00.000Z")), 1); // final (partial) day
  assert.equal(trialDaysLeft(end, Date.parse("2026-11-28T02:00:00.000Z")), 0);
  assert.equal(trialDaysLeft(end, Date.parse("2026-12-25T00:00:00.000Z")), 0);
});

test("KASSIX Pro: access lasts until the later of the trial end and the paid-up date", () => {
  const trial = { created_at: "2026-01-01T00:00:00Z", trial_ends_at: "2026-03-02T00:00:00+00:00", paid_until: null };
  assert.equal(accessEndsAt(trial), trial.trial_ends_at);
  assert.equal(hasAccess(trial, Date.parse("2026-03-01T23:59:59Z")), true);
  assert.equal(hasAccess(trial, Date.parse("2026-03-02T00:00:00Z")), false);

  const paid = { ...trial, paid_until: "2026-04-01T00:00:00.123456+00:00" };
  assert.ok(isPro(paid));
  assert.equal(accessEndsAt(paid), paid.paid_until);
  assert.equal(hasAccess(paid, Date.parse("2026-03-31T00:00:00Z")), true);
  assert.equal(hasAccess(paid, Date.parse("2026-04-02T00:00:00Z")), false);

  // Paid time that ended before a (dashboard-extended) trial doesn't cut the trial short.
  const extended = { ...trial, trial_ends_at: "2026-05-01T00:00:00Z" , paid_until: "2026-04-01T00:00:00Z" };
  assert.ok(!isPro(extended));
  assert.equal(accessEndsAt(extended), extended.trial_ends_at);
});

test("PayMongo webhook signatures", () => {
  const body = '{"data":{"id":"evt_1","attributes":{"type":"checkout_session.payment.paid"}}}';
  const sign = (secret: string, t = "1496734173") => createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const sig = sign("whsk_test");

  assert.ok(verifySignature(body, `t=1496734173,te=${sig},li=`, "whsk_test")); // test mode
  assert.ok(verifySignature(body, `t=1496734173,te=,li=${sig}`, "whsk_test")); // live mode
  assert.ok(!verifySignature(body.replace("evt_1", "evt_2"), `t=1496734173,te=${sig},li=`, "whsk_test"));
  assert.ok(!verifySignature(body, `t=1496734174,te=${sig},li=`, "whsk_test"));
  assert.ok(!verifySignature(body, `t=1496734173,te=${sig},li=`, "whsk_other"));
  assert.ok(!verifySignature(body, `t=1496734173,te=,li=`, "whsk_test"));
  assert.ok(!verifySignature(body, `t=1496734173,te=${"é".repeat(32)},li=`, "whsk_test")); // no throw on odd input
  assert.ok(!verifySignature(body, null, "whsk_test"));
});
