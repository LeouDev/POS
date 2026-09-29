import { createHmac, timingSafeEqual } from "node:crypto";
import { PLANS, type Plan } from "@/lib/trial";

/** Offered at checkout. Each must be enabled in PayMongo → Settings → Payment Methods, or checkouts fail. */
export const CHECKOUT_METHODS = { gcash: "GCash", paymaya: "Maya", qrph: "QR Ph", grab_pay: "GrabPay", card: "Card" };

/**
 * Creates a PayMongo hosted checkout for one period of KASSIX Pro and returns its URL.
 * The webhook (app/api/paymongo/webhook) adds the time once PayMongo reports it paid.
 */
export async function createCheckout({ plan, userId, origin }: { plan: Plan; userId: string; origin: string }) {
  const key = process.env.PAYMONGO_SECRET_KEY;
  if (!key) throw new Error("PAYMONGO_SECRET_KEY isn't set.");
  const { name, amount } = PLANS[plan];

  const res = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "content-type": "application/json",
      accept: "application/json",
    },
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
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => null);
  const url = json?.data?.attributes?.checkout_url;
  if (!res.ok || typeof url !== "string") {
    throw new Error(`PayMongo ${res.status}: ${JSON.stringify(json?.errors ?? json)}`);
  }
  return url;
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
