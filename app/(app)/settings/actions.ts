"use server";

import { revalidatePath } from "next/cache";
import { describeError, fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { getSession } from "@/lib/data";
import { settingsSchema } from "@/lib/schemas";

export async function updateSettings(input: unknown): Promise<ActionResult> {
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { businessName, ownerName, currency, taxRate, timezone } = parsed.data;

  const { supabase, userId } = await getSession();
  const { error } = await supabase
    .from("profiles")
    .update({ business_name: businessName, owner_name: ownerName, currency, tax_rate: taxRate, timezone })
    .eq("user_id", userId);
  if (error) return fail(describeError(error));

  revalidatePath("/", "layout");
  return ok(null);
}
