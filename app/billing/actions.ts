"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fail } from "@/lib/actions";
import { getSession } from "@/lib/data";
import { createCheckout } from "@/lib/paymongo";
import { isPlan } from "@/lib/trial";

/** Sends the owner to PayMongo's checkout to pay for one period of KASSIX Pro. */
export async function startCheckout(_: unknown, form: FormData) {
  const plan = form.get("plan");
  if (!isPlan(plan)) return fail("Choose a plan.");
  const { userId } = await getSession();
  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  let url: string;
  try {
    url = await createCheckout({ plan, userId, origin });
  } catch (err) {
    console.error("[paymongo]", err);
    return fail("Couldn't open the PayMongo checkout. Please try again in a moment.");
  }
  redirect(url);
}
