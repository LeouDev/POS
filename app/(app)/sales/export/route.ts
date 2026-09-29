import type { NextRequest } from "next/server";
import { describeError } from "@/lib/actions";
import { getProfile, getSession } from "@/lib/data";
import { EXPORT_COLUMNS, filterSales, itemsCsv, salesCsv, salesFilters, type ExportSale } from "@/lib/sales";

/**
 * GET /sales/export?q=&from=&to=&method=[&rows=items] : the Sales page's current list as a CSV download,
 * one row per sale, or one row per product sold with rows=items.
 */
export async function GET(request: NextRequest) {
  const filters = salesFilters(Object.fromEntries(request.nextUrl.searchParams));
  const perItem = request.nextUrl.searchParams.get("rows") === "items";
  const [{ supabase }, profile] = await Promise.all([getSession(), getProfile()]);

  const sales: ExportSale[] = [];
  for (let from = 0; ; from += 1000) {
    const query = supabase
      .from("sales")
      .select(EXPORT_COLUMNS)
      .order("created_at", { ascending: false })
      .order("product_name", { referencedTable: "sale_items" })
      .order("id")
      .range(from, from + 999); // PostgREST returns at most 1,000 rows per request
    const { data, error } = await filterSales(query, filters, profile.timezone);
    if (error) return new Response(describeError(error), { status: 500 });
    sales.push(...data);
    if (data.length < 1000) break;
  }

  const range = [filters.from || "start", filters.to || new Date().toISOString().slice(0, 10)].join("-to-");
  const csv = (perItem ? itemsCsv : salesCsv)(sales, profile.timezone, profile.currency);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kassix-${perItem ? "products-sold" : "sales"}-${range}.csv"`,
      "cache-control": "no-store",
    },
  });
}
