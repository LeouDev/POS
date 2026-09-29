import { z } from "zod";
import { parseCsv, toCsv } from "@/lib/csv";
import type { ProductWithCategory } from "@/lib/database.types";
import { categoryNameSchema, productSchema } from "@/lib/schemas";

export const MAX_IMPORT_ROWS = 1000;

/** One product from an import file. The category is a name; missing ones are created on import. */
export const importRowSchema = productSchema
  .pick({ name: true, sku: true, price: true, cost: true, stockQuantity: true, lowStockThreshold: true })
  .extend({ category: z.union([z.literal(""), categoryNameSchema]) });
export type ImportRow = z.infer<typeof importRowSchema>;

type Column = "name" | "sku" | "category" | "price" | "cost" | "stock" | "alert";

// Header names we recognise (lower case, spaces for _ and -), so most owners' own sheets work too.
const HEADERS: Record<Column, string[]> = {
  name: ["name", "product", "product name", "item", "item name"],
  sku: ["sku", "barcode", "sku / barcode", "code", "item code"],
  category: ["category", "group"],
  price: ["price", "selling price", "retail price", "srp"],
  cost: ["cost", "cost price", "unit cost"],
  stock: ["stock", "stock on hand", "quantity", "qty", "on hand"],
  alert: ["low stock alert", "low stock alert at", "reorder level", "alert at"],
};

// The template's and the export's columns, so an exported list can be imported into another account.
const COLUMN_TITLES = ["Name", "SKU", "Category", "Price", "Cost", "Stock", "Low stock alert"];

/** The downloadable starting point: the headers plus two example rows to replace. */
export const templateCsv = () =>
  toCsv([
    COLUMN_TITLES,
    ["Iced Coffee", "DRK-001", "Drinks", 120, 45, 40, 10],
    ["Pandesal (10 pcs)", "", "Bakery", 50, 20, 20, 5],
  ]);

/** The product list in the import's columns, plus Status and Stock value (stock × cost), which import ignores. */
export const productsCsv = (products: ProductWithCategory[]) =>
  toCsv([
    [...COLUMN_TITLES, "Status", "Stock value"],
    ...products.map((p) => [
      p.name,
      p.sku ?? "",
      p.categories?.name ?? "",
      p.price,
      p.cost,
      p.stock_quantity,
      p.low_stock_threshold,
      p.is_active ? "Active" : "Archived",
      Math.round(p.stock_quantity * p.cost * 100) / 100,
    ]),
  ]);

// "₱1,234.50" or "PHP 45" → a number; blank → the fallback (NaN makes the schema report it as missing).
const toNumber = (raw: string, fallback: number) => {
  const s = raw.replace(/₱|php|,|\s/gi, "");
  return s === "" ? fallback : Number(s);
};

export type ImportLine = { line: number; name: string; row?: ImportRow; error?: string };

/** Reads an import file into lines that are either ready (row) or need fixing (error). */
export function readImportFile(text: string): { lines: ImportLine[]; error?: string } {
  const [header, ...body] = parseCsv(text);
  if (!header) return { lines: [], error: "That file is empty." };
  const normal = header.map((h) => h.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " "));
  const index = Object.fromEntries(
    (Object.keys(HEADERS) as Column[]).map((c) => [c, normal.findIndex((h) => HEADERS[c].includes(h))]),
  ) as Record<Column, number>;
  if (index.name < 0 || index.price < 0) {
    return { lines: [], error: "The file needs at least a Name and a Price column. Download the template to see the layout." };
  }
  if (body.length > MAX_IMPORT_ROWS) {
    return { lines: [], error: `That's ${body.length} products; import at most ${MAX_IMPORT_ROWS} at a time.` };
  }

  const firstLineOfSku = new Map<string, number>();
  const lines = body.map((cells, i): ImportLine => {
    const line = i + 2; // spreadsheet row number, with the header on row 1
    const get = (c: Column) => (index[c] < 0 ? "" : (cells[index[c]] ?? "").trim());
    const parsed = importRowSchema.safeParse({
      name: get("name"),
      sku: get("sku"),
      category: get("category"),
      price: toNumber(get("price"), NaN),
      cost: toNumber(get("cost"), 0),
      stockQuantity: toNumber(get("stock"), 0),
      lowStockThreshold: toNumber(get("alert"), 5),
    });
    if (!parsed.success) return { line, name: get("name"), error: parsed.error.issues[0]?.message };
    const sku = parsed.data.sku.toLowerCase();
    const first = sku ? firstLineOfSku.get(sku) : undefined;
    if (first) return { line, name: parsed.data.name, error: `Same SKU as row ${first}` };
    if (sku) firstLineOfSku.set(sku, line);
    return { line, name: parsed.data.name, row: parsed.data };
  });
  return { lines };
}

/**
 * Splits rows into new products and ones to skip because they're already in KASSIX (same SKU, or same
 * name when the row has no SKU), so importing the same file twice doesn't duplicate anything.
 */
export function planImport(rows: ImportRow[], existing: { name: string; sku: string | null }[]) {
  const skus = new Set(existing.flatMap((p) => (p.sku ? [p.sku.toLowerCase()] : [])));
  const names = new Set(existing.map((p) => p.name.toLowerCase()));
  const create: ImportRow[] = [];
  const skipped: { name: string; reason: string }[] = [];
  for (const row of rows) {
    const [sku, name] = [row.sku.toLowerCase(), row.name.toLowerCase()];
    if (sku && skus.has(sku)) skipped.push({ name: row.name, reason: `SKU ${row.sku} is already in your products` });
    else if (!sku && names.has(name)) skipped.push({ name: row.name, reason: "already in your products" });
    else {
      create.push(row);
      if (sku) skus.add(sku);
      names.add(name);
    }
  }
  return { create, skipped };
}
