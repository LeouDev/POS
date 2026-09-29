import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { POST } from "../app/api/paymongo/webhook/route";
import { confirmCheckout } from "../lib/paymongo";

// PayMongo's and Supabase's HTTP APIs are stubbed: these tests check what KASSIX asks of them.
process.env.PAYMONGO_WEBHOOK_SECRET = "whsk_test_fake";
process.env.PAYMONGO_SECRET_KEY = "sk_test_fake";
process.env.SUPABASE_SECRET_KEY = "sb_secret_fake";
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fake";

const OWNER = "11111111-1111-4111-8111-111111111111";
let recorded: Record<string, unknown>[] = [];
let paymongoSession: object | null = null;
let failDatabase = false;

globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input instanceof Request ? input.url : input);
  if (url.startsWith("https://api.paymongo.com/v1/checkout_sessions/")) {
    return Response.json(paymongoSession ? { data: paymongoSession } : { errors: [{ code: "resource_not_found" }] }, {
      status: paymongoSession ? 200 : 404,
    });
  }
  if (url === "https://example.supabase.co/rest/v1/rpc/record_payment") {
    assert.equal(new Headers(init?.headers).get("apikey"), "sb_secret_fake");
    if (failDatabase) return Response.json({ code: "P0001", message: "boom" }, { status: 400 });
    recorded.push(JSON.parse(String(init?.body)));
    return Response.json({ user_id: OWNER });
  }
  throw new Error(`Unexpected request to ${url}`);
}) as typeof fetch;

const session = (metadata: object | null, amount = 39900, source = "gcash", status = "paid") => ({
  id: "cs_test123",
  type: "checkout_session",
  attributes: {
    metadata,
    payments: [{ id: "pay_abc", type: "payment", attributes: { amount, currency: "PHP", status, source: { type: source } } }],
  },
});

async function deliver(type: string, data: object, { secret = "whsk_test_fake", slot = "te" } = {}) {
  const body = JSON.stringify({ data: { id: "evt_1", type: "event", attributes: { type, livemode: slot === "li", data } } });
  const t = "1767225600";
  const sig = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  const header = slot === "te" ? `t=${t},te=${sig},li=` : `t=${t},te=,li=${sig}`;
  const res = await POST(new Request("https://kassix.test/api/paymongo/webhook", { method: "POST", body, headers: { "paymongo-signature": header } }));
  return { status: res.status, json: await res.json() };
}

const quietly = async <T>(fn: () => Promise<T>) => {
  const log = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = log;
  }
};

test("webhook: only signed, paid KASSIX Pro checkouts add time", async () => {
  recorded = [];
  const monthly = { user_id: OWNER, plan: "monthly" };

  assert.equal((await deliver("checkout_session.payment.paid", session(monthly), { secret: "whsk_forged" })).status, 401);
  assert.deepEqual((await deliver("payment.paid", {})).json, { received: true });
  assert.deepEqual((await deliver("checkout_session.payment.paid", session({ order: "123" }))).json, { received: true, recorded: false });
  const underpaid = await quietly(() => deliver("checkout_session.payment.paid", session({ ...monthly, plan: "yearly" })));
  assert.deepEqual(underpaid.json, { received: true, recorded: false });
  assert.equal(recorded.length, 0);

  assert.deepEqual((await deliver("checkout_session.payment.paid", session(monthly))).json, { received: true, recorded: true });
  const yearly = await deliver("checkout_session.payment.paid", session({ ...monthly, plan: "yearly" }, 399000, "card"), { slot: "li" });
  assert.equal(yearly.status, 200);
  assert.deepEqual(recorded, [
    { p_user_id: OWNER, p_plan: "monthly", p_amount: 399, p_checkout_session_id: "cs_test123", p_payment_id: "pay_abc", p_method: "gcash" },
    { p_user_id: OWNER, p_plan: "yearly", p_amount: 3990, p_checkout_session_id: "cs_test123", p_payment_id: "pay_abc", p_method: "card" },
  ]);

  // A database failure answers 500 so PayMongo retries.
  failDatabase = true;
  assert.equal((await quietly(() => deliver("checkout_session.payment.paid", session(monthly)))).status, 500);
  failDatabase = false;
});

test("return check: records the owner's own paid checkout, nothing else", async () => {
  recorded = [];
  const monthly = { user_id: OWNER, plan: "monthly" };

  assert.equal(await confirmCheckout("../v1/payments", OWNER), false); // not a session id: PayMongo isn't called
  paymongoSession = session({ user_id: "someone-else", plan: "monthly" });
  assert.equal(await confirmCheckout("cs_test123", OWNER), false);
  paymongoSession = session(monthly, 39900, "qrph", "pending");
  assert.equal(await confirmCheckout("cs_test123", OWNER), false);
  assert.equal(recorded.length, 0);

  paymongoSession = session(monthly, 39900, "qrph");
  assert.equal(await confirmCheckout("cs_test123", OWNER), true);
  assert.deepEqual(recorded, [
    { p_user_id: OWNER, p_plan: "monthly", p_amount: 399, p_checkout_session_id: "cs_test123", p_payment_id: "pay_abc", p_method: "qrph" },
  ]);

  paymongoSession = null; // PayMongo unreachable or unknown session: the page logs it and waits for the webhook
  await assert.rejects(confirmCheckout("cs_missing", OWNER), /PayMongo 404/);
});
