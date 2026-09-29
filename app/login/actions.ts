"use server";

import type { AuthError } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fail, invalid, ok, safeNext, type ActionResult } from "@/lib/actions";
import { newPasswordSchema, resetRequestSchema, signInSchema, signUpSchema } from "@/lib/schemas";
import { createClient } from "@/lib/supabase/server";

const EXISTING_ACCOUNT = "This email address already has a KASSIX account. Sign in instead.";

function authMessage(error: AuthError) {
  switch (error.code) {
    case "invalid_credentials":
      return "Wrong email or password.";
    case "email_not_confirmed":
      return "Confirm your email first: open the link we sent to your inbox.";
    case "user_already_exists":
    case "email_exists":
      return EXISTING_ACCOUNT;
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
    case "signup_disabled":
      return "New sign-ups are turned off for this store.";
    case "same_password":
      return "Choose a password that's different from your old one.";
  }
  if (error.status === 0 || /fetch/i.test(error.message)) return "Couldn't reach the server. Check your connection.";
  return error.message;
}

/** This site's address, for links in emails (confirmation, password reset). */
async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
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

  const origin = await siteOrigin();
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
  // One account per email. With "Confirm email" on, Supabase doesn't error for an address that already
  // has a confirmed account: it returns a placeholder user with no identities and sends nothing.
  // (An unconfirmed address gets a fresh confirmation email and a real user, so that case carries on.)
  if (data.user && data.user.identities?.length === 0) return fail(EXISTING_ACCOUNT);
  if (data.session) redirect("/dashboard");
  return ok({ confirmEmail: true });
}

/** Emails a link for choosing a new password. Doesn't reveal whether the address has an account. */
export async function requestPasswordReset(input: unknown): Promise<ActionResult> {
  const parsed = resetRequestSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reset-password`,
  });
  if (error) return fail(authMessage(error));
  return ok(null);
}

/** Sets a new password for the signed-in user (after following a reset link). */
export async function updatePassword(input: unknown): Promise<ActionResult> {
  const parsed = newPasswordSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return fail(authMessage(error));
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  // This device only: the default ("global") would also sign out the register and every other device.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
