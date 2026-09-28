"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fail, invalid, ok, safeNext, type ActionResult } from "@/lib/actions";
import { signInSchema, signUpSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

function authMessage(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Confirm your email first: open the link we sent to your inbox.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "signup_disabled":
      return "New sign-ups are turned off for this store.";
  }
  if (error.status === 0 || /fetch/i.test(error.message)) return "Couldn't reach the server. Check your connection.";
  return error.message;
}

export async function signIn(input: unknown, next: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(authMessage(error));
  redirect(safeNext(next));
}

export async function signUp(input: unknown): Promise<ActionResult<{ confirmEmail: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { businessName, ownerName, email, password, timezone } = parsed.data;

  const h = await headers();
  const origin = h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { business_name: businessName, owner_name: ownerName, timezone },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) return fail(authMessage(error));
  if (data.session) redirect("/dashboard");
  return ok({ confirmEmail: true });
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
