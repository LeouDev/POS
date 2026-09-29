import { recordCheckout, verifySignature, type CheckoutSession } from "@/lib/paymongo";

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
  try {
    const recorded = await recordCheckout(session, session.attributes.payments?.[0]);
    return Response.json({ received: true, recorded });
  } catch (err) {
    console.error("[paymongo]", err);
    return Response.json({ error: "Couldn't record the payment" }, { status: 500 });
  }
}
