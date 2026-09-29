"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { fail } from "@/lib/actions";
import { getSession } from "@/lib/data";
import { CHECKOUT_COOKIE, createCheckout } from "@/lib/paymongo";
import { isPlan } from "@/lib/trial";

/** Sends the owner to PayMongo's checkout to pay for one period of KASSIX Pro. */
export async function startCheckout(_: unknown, form: FormData) {
  const plan = form.get("plan");
  if (!isPlan(plan)) return fail("Choose a plan.");
  const { userId } = await getSession();
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  let checkout: { id: string; url: string };
  try {
    checkout = await createCheckout({ plan, userId, origin });
  } catch (err) {
    console.error("[paymongo]", err);
    return fail("Couldn't open the PayMongo checkout. Please try again in a moment.");
  }
  (await cookies()).set(CHECKOUT_COOKIE, checkout.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // sent when PayMongo redirects back
    path: "/billing",
    maxAge: 60 * 60,
  });
  redirect(checkout.url);
}
