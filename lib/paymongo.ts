import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { isPlan, PLANS, type Plan } from "@/lib/trial";

/** Offered at checkout. Each must be enabled in PayMongo → Settings → Payment Methods, or checkouts fail. */
export const CHECKOUT_METHODS = { gcash: "GCash", paymaya: "Maya", qrph: "QR Ph", grab_pay: "GrabPay", card: "Card" };

/** Holds the owner's latest checkout session id, so /billing can confirm it with PayMongo on their return. */
export const CHECKOUT_COOKIE = "kassix_checkout";

type Payment = { id: string; attributes: { amount: number; status?: string; source?: { type?: string } } };
export type CheckoutSession = {
  id: string;
  attributes: { metadata?: Record<string, string> | null; payments?: Payment[] };
};

/** Calls the PayMongo API with the secret key and returns the response's `data`. */
async function paymongo(path: string, init?: RequestInit) {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY isn't set.");
  const res = await fetch(`https://api.paymongo.com${path}`, {
    ...init,
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.data) throw new Error(`PayMongo ${res.status}: ${JSON.stringify(json?.errors ?? json)}`);
  return json.data;
}

/**
 * Creates a PayMongo hosted checkout for one period of KASSIX Pro.
 * The webhook (app/api/paymongo/webhook) adds the time once PayMongo reports it paid.
 */
export async function createCheckout({ plan, userId, origin }: { plan: Plan; userId: string; origin: string }) {
  const { name, amount } = PLANS[plan];
  const data = await paymongo("/v2/checkout_sessions", {
    method: "POST",
    body: JSON.stringify({
      data: {
        attributes: {
          line_items: [{ name, amount: amount * 100, currency: "PHP", quantity: 1 }],
          payment_method_types: Object.keys(CHECKOUT_METHODS),
          description: name,
          metadata: { user_id: userId, plan },
          send_email_receipt: true,
          // The timestamp lets /billing tell "still confirming" apart from an old link.
          success_url: `${origin}/billing?checkout=${Date.now()}`,
          cancel_url: `${origin}/billing`,
        },
      },
    }),
  });
  const url = data.attributes?.checkout_url;
  if (typeof data.id !== "string" || typeof url !== "string") throw new Error("PayMongo returned no checkout URL.");
  return { id: data.id, url };
}

/**
 * Adds a paid KASSIX Pro checkout's days to its account and returns whether it did. Safe to repeat:
 * record_payment() ignores sessions it has already recorded. Throws if the database call fails.
 */
export async function recordCheckout(session: CheckoutSession, payment: Payment | undefined) {
  const { user_id: userId, plan } = session.attributes.metadata ?? {};
  if (!userId || !isPlan(plan)) return false; // another product's checkout on the same PayMongo account
  const amount = (payment?.attributes.amount ?? PLANS[plan].amount * 100) / 100;
  if (amount < PLANS[plan].amount) {
    console.error("[paymongo] paid less than the plan price", session.id, plan, amount);
    return false;
  }
  const { error } = await createAdminClient().rpc("record_payment", {
    p_user_id: userId,
    p_plan: plan,
    p_amount: amount,
    p_checkout_session_id: session.id,
    p_payment_id: payment?.id ?? null,
    p_method: payment?.attributes.source?.type ?? null,
  });
  if (error) throw new Error(`record_payment failed for ${session.id}: ${error.message}`);
  return true;
}

/**
 * Asks PayMongo whether the owner's checkout is paid and records it if so; returns whether it's recorded.
 * Covers a late or missing webhook for owners who come back to /billing after paying.
 */
export async function confirmCheckout(sessionId: string, userId: string) {
  if (!/^cs_\w+$/.test(sessionId)) return false;
  const session: CheckoutSession = await paymongo(`/v1/checkout_sessions/${sessionId}`);
  if (session.attributes.metadata?.user_id !== userId) return false;
  const payment = session.attributes.payments?.find((p) => p.attributes.status === "paid");
  return payment ? recordCheckout(session, payment) : false;
}

/**
 * Checks a `Paymongo-Signature` header (`t=…,te=…,li=…`): an HMAC-SHA256 of `${t}.${rawBody}` keyed with the
 * webhook secret, in `te` for test-mode events and `li` for live ones.
 */
// ponytail: no timestamp tolerance check; a replayed event is harmless because record_payment() is
// idempotent per checkout session. Add one if the webhook ever does something that isn't.
export function verifySignature(rawBody: string, header: string | null, secret: string) {
  const parts = Object.fromEntries((header ?? "").split(",").map((part) => part.trim().split("=")));
  if (!parts.t) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex"));
  return [parts.te, parts.li].some((sig) => {
    const given = Buffer.from(sig ?? "");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
