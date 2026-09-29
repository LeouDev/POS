"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { describeError, fail, invalid, ok, type ActionResult } from "@/lib/actions";
import { getSession } from "@/lib/data";
import { importRowSchema, MAX_IMPORT_ROWS, planImport } from "@/lib/product-import";
import { categoryNameSchema, productSchema } from "@/lib/schemas";

const id = z.uuid();

function refresh() {
  revalidatePath("/", "layout");
}

type Supabase = Awaited<ReturnType<typeof getSession>>["supabase"];

/** Category ids by lower-cased name, creating any of `names` that don't exist yet. */
async function ensureCategories(supabase: Supabase, names: string[]): Promise<Map<string, string> | { error: string }> {
  const { data: existing, error: loadError } = await supabase.from("categories").select("id, name");
  if (loadError) return { error: describeError(loadError) };
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c.id]));
  const missing = [...new Map(names.map((n) => [n.toLowerCase(), n])).values()].filter((n) => !byName.has(n.toLowerCase()));
  if (missing.length) {
    const { data: created, error } = await supabase
      .from("categories")
      .insert(missing.map((name) => ({ name })))
      .select("id, name");
    if (error) return { error: describeError(error) };
    for (const c of created) byName.set(c.name.toLowerCase(), c.id);
  }
  return byName;
}

export async function saveProduct(productId: string | null, input: unknown): Promise<ActionResult> {
  const parsed = productSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  if (productId !== null && !id.safeParse(productId).success) return fail("Unknown product.");
  const p = parsed.data;
  const fields = {
    name: p.name,
    sku: p.sku || null,
    category_id: p.categoryId || null,
    price: p.price,
    cost: p.cost,
    low_stock_threshold: p.lowStockThreshold,
    is_active: p.isActive,
  };

  const { supabase } = await getSession();
  // Stock only changes through Inventory after creation, so every change is logged.
  const { error } = productId
    ? await supabase.from("products").update(fields).eq("id", productId)
    : await supabase.from("products").insert({ ...fields, stock_quantity: p.stockQuantity });
  if (error) return fail(describeError(error));
  refresh();
  return ok(null);
}

export async function setProductActive(productId: string, active: boolean): Promise<ActionResult> {
  if (!id.safeParse(productId).success) return fail("Unknown product.");
  const { supabase } = await getSession();
  const { error } = await supabase.from("products").update({ is_active: active }).eq("id", productId);
  if (error) return fail(describeError(error));
  refresh();
  return ok(null);
}

/** Deletes a product, or archives it when it appears in past sales (history must stay intact). */
export async function deleteProduct(productId: string): Promise<ActionResult<{ archived: boolean }>> {
  if (!id.safeParse(productId).success) return fail("Unknown product.");
  const { supabase } = await getSession();
  const { error } = await supabase.from("products").delete().eq("id", productId);
  if (error?.code === "23503") {
    const { error: archiveError } = await supabase.from("products").update({ is_active: false }).eq("id", productId);
    if (archiveError) return fail(describeError(archiveError));
    refresh();
    return ok({ archived: true });
  }
  if (error) return fail(describeError(error));
  refresh();
  return ok({ archived: false });
}

export async function createCategory(name: unknown): Promise<ActionResult> {
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getSession();
  const { error } = await supabase.from("categories").insert({ name: parsed.data });
  if (error) return fail(describeError(error));
  refresh();
  return ok(null);
}

export async function renameCategory(categoryId: string, name: unknown): Promise<ActionResult> {
  const parsed = categoryNameSchema.safeParse(name);
  if (!parsed.success) return invalid(parsed.error);
  if (!id.safeParse(categoryId).success) return fail("Unknown category.");
  const { supabase } = await getSession();
  const { error } = await supabase.from("categories").update({ name: parsed.data }).eq("id", categoryId);
  if (error) return fail(describeError(error));
  refresh();
  return ok(null);
}

/** Products in the category become uncategorised (FK is ON DELETE SET NULL). */
export async function deleteCategory(categoryId: string): Promise<ActionResult> {
  if (!id.safeParse(categoryId).success) return fail("Unknown category.");
  const { supabase } = await getSession();
  const { error } = await supabase.from("categories").delete().eq("id", categoryId);
  if (error) return fail(describeError(error));
  refresh();
  return ok(null);
}

const SAMPLES: Record<string, [name: string, sku: string, price: number, cost: number, stock: number, alertAt: number][]> = {
  Drinks: [
    ["Iced Coffee", "DRK-001", 120, 45, 40, 10],
    ["Bottled Water", "DRK-002", 25, 10, 60, 15],
    ["Mango Shake", "DRK-003", 95, 40, 8, 10],
  ],
  Snacks: [
    ["Potato Chips", "SNK-001", 45, 22, 30, 8],
    ["Chocolate Bar", "SNK-002", 60, 30, 0, 5],
    ["Roasted Peanuts", "SNK-003", 35, 15, 25, 8],
  ],
  Bakery: [
    ["Pandesal (10 pcs)", "BKR-001", 50, 20, 20, 6],
    ["Ensaymada", "BKR-002", 45, 18, 4, 5],
    ["Banana Bread", "BKR-003", 85, 35, 12, 4],
  ],
};

/** One-click starter catalogue for trying the register (offered only when there are no products). */
export async function addSampleProducts(): Promise<ActionResult> {
  const { supabase } = await getSession();
  const byName = await ensureCategories(supabase, Object.keys(SAMPLES));
  if (!(byName instanceof Map)) return fail(byName.error);

  const rows = Object.entries(SAMPLES).flatMap(([category, items]) =>
    items.map(([name, sku, price, cost, stock, alertAt]) => ({
      name,
      sku,
      price,
      cost,
      stock_quantity: stock,
      low_stock_threshold: alertAt,
      category_id: byName.get(category.toLowerCase()) ?? null,
    })),
  );
  const { error } = await supabase.from("products").insert(rows);
  if (error) return fail(describeError(error));
  refresh();
  return ok(null);
}

/**
 * Adds products from an import file in one insert (all or nothing). Rows already in KASSIX are skipped
 * rather than overwritten, so stock only ever changes through Inventory; opening stock is logged by
 * the products_log_opening_stock trigger like any new product.
 */
export async function importProducts(
  input: unknown,
): Promise<ActionResult<{ imported: number; skipped: { name: string; reason: string }[] }>> {
  const parsed = z
    .array(importRowSchema)
    .min(1, "There are no products to import.")
    .max(MAX_IMPORT_ROWS, `Import at most ${MAX_IMPORT_ROWS} products at a time.`)
    .safeParse(input);
  if (!parsed.success) return invalid(parsed.error);
  const { supabase } = await getSession();

  const existing: { name: string; sku: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("products").select("name, sku").order("id").range(from, from + 999);
    if (error) return fail(describeError(error));
    existing.push(...data);
    if (data.length < 1000) break;
  }
  const { create, skipped } = planImport(parsed.data, existing);
  if (!create.length) return ok({ imported: 0, skipped });

  const byName = await ensureCategories(supabase, create.flatMap((r) => (r.category ? [r.category] : [])));
  if (!(byName instanceof Map)) return fail(byName.error);
  const { error } = await supabase.from("products").insert(
    create.map((r) => ({
      name: r.name,
      sku: r.sku || null,
      category_id: r.category ? (byName.get(r.category.toLowerCase()) ?? null) : null,
      price: r.price,
      cost: r.cost,
      stock_quantity: r.stockQuantity,
      low_stock_threshold: r.lowStockThreshold,
    })),
  );
  if (error) return fail(describeError(error));
  refresh();
  return ok({ imported: create.length, skipped });
}
