import { verifySignature } from "@/lib/paymongo";
import { createAdminClient } from "@/lib/supabase/server";
import { isPlan, PLANS } from "@/lib/trial";

type CheckoutSession = {
  id: string;
  attributes: {
    metadata?: Record<string, string> | null;
    payments?: { id: string; attributes: { amount: number; source?: { type?: string } } }[];
  };
};

/**
 * PayMongo → Developers → Webhooks, event `checkout_session.payment.paid`. A paid KASSIX Pro checkout adds its
 * days to the account. PayMongo retries anything but a 2xx, and record_payment() makes retries harmless.
 */
export async function POST(request: Request) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[paymongo] PAYMONGO_WEBHOOK_SECRET isn't set");
    return Response.json({ error: "Webhook not configured" }, { status: 500 });
  }
  const raw = await request.text();
  if (!verifySignature(raw, request.headers.get("paymongo-signature"), secret)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(raw)?.data?.attributes;
  if (event?.type !== "checkout_session.payment.paid") return Response.json({ received: true });

  const session: CheckoutSession = event.data;
  const { user_id: userId, plan } = session.attributes.metadata ?? {};
  if (!userId || !isPlan(plan)) return Response.json({ received: true, ignored: "Not a KASSIX Pro checkout" });

  const payment = session.attributes.payments?.[0];
  const amount = (payment?.attributes.amount ?? PLANS[plan].amount * 100) / 100;
  if (amount < PLANS[plan].amount) {
    console.error("[paymongo] paid less than the plan price", session.id, plan, amount);
    return Response.json({ received: true, ignored: "Amount is below the plan price" });
  }

  const { error } = await createAdminClient().rpc("record_payment", {
    p_user_id: userId,
    p_plan: plan,
    p_amount: amount,
    p_checkout_session_id: session.id,
    p_payment_id: payment?.id ?? null,
    p_method: payment?.attributes.source?.type ?? null,
  });
  if (error) {
    console.error("[paymongo] record_payment failed", session.id, error);
    return Response.json({ error: "Couldn't record the payment" }, { status: 500 });
  }
  return Response.json({ received: true });
}
