import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { describeError, MISSING_TABLES } from "@/lib/actions";
import { isValidTimezone } from "@/lib/format";
import type { Category, Profile, ProductWithCategory } from "@/lib/database.types";

/** The signed-in user and a Supabase client acting as them. Redirects to /login otherwise. */
export const getSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/login");
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
    metadata: (claims.user_metadata ?? {}) as Record<string, unknown>,
  };
});

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** The business profile, created on first visit from the details given at sign-up. */
export const getProfile = cache(async (): Promise<Profile> => {
  const { supabase, userId, metadata } = await getSession();
  const load = () => supabase.from("profiles").select("*").eq("user_id", userId).maybeSingle();

  const { data, error } = await load();
  if (error) throw new Error(describeError(error));
  if (data) return data;

  const timezone = text(metadata.timezone);
  const { error: insertError } = await supabase.from("profiles").insert({
    user_id: userId,
    business_name: text(metadata.business_name).slice(0, 100) || "My Store",
    owner_name: text(metadata.owner_name).slice(0, 100),
    timezone: isValidTimezone(timezone) ? timezone : "UTC",
  });
  if (insertError && insertError.code !== "23505") throw new Error(describeError(insertError));

  const { data: created, error: reloadError } = await load();
  if (reloadError || !created) throw new Error(reloadError ? describeError(reloadError) : MISSING_TABLES);
  return created;
});

// ponytail: loads the whole catalogue in one request (PostgREST caps responses at 1,000 rows);
// move filtering into the query and paginate if a shop ever carries more products than that.
export const getProducts = cache(async (): Promise<ProductWithCategory[]> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("products").select("*, categories(name)").order("name").limit(1000);
  if (error) throw new Error(describeError(error));
  return data;
});

export const getCategories = cache(async (): Promise<Category[]> => {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("categories").select("*").order("name");
  if (error) throw new Error(describeError(error));
  return data;
});

/** First value of a search param as a string ("" when absent). */
export const param = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
