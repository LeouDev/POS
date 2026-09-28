import { unstable_rethrow } from "next/navigation";
import type { ZodError } from "zod";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
export const invalid = (error: ZodError) => fail(error.issues[0]?.message ?? "Check the form and try again.");

/** Calls a server action from the browser; a dropped connection becomes an error result, not a silent failure. */
export async function safeCall<T>(action: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await action();
  } catch (err) {
    unstable_rethrow(err); // redirects (e.g. signed out) are navigation, not failures
    return fail("Couldn't reach the server. Check your connection and try again.");
  }
}

/** Only same-site paths, so ?next= can't bounce users to another site (incl. "//x" and "/\x"). */
export function safeNext(next: unknown) {
  if (typeof next !== "string" || !next.startsWith("/")) return "/dashboard";
  const url = new URL(next, "http://same.invalid");
  return url.origin === "http://same.invalid" ? url.pathname + url.search : "/dashboard";
}

type DbError = { code?: string; message: string } | null;

const UNIQUE_MESSAGES: Record<string, string> = {
  products_user_sku_key: "Another product already uses this SKU.",
  categories_user_name_key: "A category with this name already exists.",
};

export const MISSING_TABLES =
  "The KASSIX tables aren't in your Supabase database yet. Run supabase/migrations/20260929000000_init.sql in the Supabase SQL editor (or `npx supabase db push`), then reload.";

/** Turns a Supabase/Postgres error into a message that is safe and useful to show. */
export function describeError(error: DbError): string {
  if (!error) return "Something went wrong. Please try again.";
  switch (error.code) {
    case "P0001": // raised by our SQL functions with a human-readable message
    case "28000":
      return error.message;
    case "23505":
      return (
        Object.entries(UNIQUE_MESSAGES).find(([name]) => error.message.includes(name))?.[1] ?? "That already exists."
      );
    case "23503":
      return "This record is still in use elsewhere.";
    case "42501":
      return "You don't have permission to do that. Try signing in again.";
    case "PGRST205":
    case "42P01":
    case "PGRST202":
      return MISSING_TABLES;
  }
  console.error("[db]", error);
  return "Couldn't reach the database. Check your connection and try again.";
}
