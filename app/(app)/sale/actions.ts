"use server";

import { revalidatePath } from "next/cache";
import { describeError, fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { getSession } from "@/lib/data";
import type { SaleWithItems } from "@/lib/database.types";
import { checkoutSchema } from "@/lib/schemas";

/**
 * Records a sale through complete_sale (one transaction: sale, items, movements, stock).
 * Safe to retry with the same saleId: a sale that already went through is returned as-is.
 */
export async function checkout(input: unknown): Promise<ActionResult<SaleWithItems>> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { saleId, items, paymentMethod, discount, expectedTotal } = parsed.data;

  const { supabase } = await getSession();
  const { error } = await supabase.rpc("complete_sale", {
    p_sale_id: saleId,
    p_items: items.map((i) => ({ product_id: i.productId, quantity: i.quantity })),
    p_payment_method: paymentMethod,
    p_discount: discount,
    p_expected_total: expectedTotal,
  });
  // Refresh even on failure: stale prices or stock are the usual reason a sale is refused.
  revalidatePath("/", "layout");
  if (error) return fail(describeError(error));

  const { data: sale, error: loadError } = await supabase
    .from("sales")
    .select("*, sale_items(*)")
    .eq("id", saleId)
    .order("product_name", { referencedTable: "sale_items" })
    .single();
  if (loadError) return fail("The sale was recorded, but its receipt didn't load. You'll find it under Sales.");
  return ok(sale);
}
