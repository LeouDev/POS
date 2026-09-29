import type { NextRequest } from "next/server";
import { describeError } from "@/lib/actions";
import { getProfile, getSession } from "@/lib/data";
import { filterSales, salesCsv, salesFilters, type ExportSale } from "@/lib/sales";

/** GET /sales/export?q=&from=&to=&method= : the Sales page's current list as a CSV download. */
export async function GET(request: NextRequest) {
  const filters = salesFilters(Object.fromEntries(request.nextUrl.searchParams));
  const [{ supabase }, profile] = await Promise.all([getSession(), getProfile()]);

  const sales: ExportSale[] = [];
  for (let from = 0; ; from += 1000) {
    const query = supabase
      .from("sales")
      .select("receipt_number, created_at, subtotal, discount, tax, total, payment_method, status, sale_items(quantity, unit_cost)")
      .order("created_at", { ascending: false })
      .order("id")
      .range(from, from + 999); // PostgREST returns at most 1,000 rows per request
    const { data, error } = await filterSales(query, filters, profile.timezone);
    if (error) return new Response(describeError(error), { status: 500 });
    sales.push(...data);
    if (data.length < 1000) break;
  }

  const range = [filters.from || "start", filters.to || new Date().toISOString().slice(0, 10)].join("-to-");
  return new Response(salesCsv(sales, profile.timezone, profile.currency), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kassix-sales-${range}.csv"`,
      "cache-control": "no-store",
    },
  });
}
