"use server";

import { revalidatePath } from "next/cache";
import { describeError, fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { getSession } from "@/lib/data";
import { voidSaleSchema } from "@/lib/schemas";

export async function voidSale(input: unknown): Promise<ActionResult> {
  const parsed = voidSaleSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);

  const { supabase } = await getSession();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: parsed.data.saleId, p_reason: parsed.data.reason });
  if (error) return fail(describeError(error));

  revalidatePath("/", "layout");
  return ok(null);
}
