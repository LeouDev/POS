"use server";

import { revalidatePath } from "next/cache";
import { describeError, fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { getSession } from "@/lib/data";
import { adjustStockSchema } from "@/lib/schemas";

export async function adjustStock(input: unknown): Promise<ActionResult<{ stock: number }>> {
  const parsed = adjustStockSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { productId, type, quantity, notes } = parsed.data;

  const { supabase } = await getSession();
  const { data, error } = await supabase.rpc("adjust_stock", {
    p_product_id: productId,
    p_type: type,
    p_quantity: quantity,
    p_notes: notes || null,
  });
  if (error) return fail(describeError(error));

  revalidatePath("/", "layout");
  return ok({ stock: data.stock_quantity });
}
