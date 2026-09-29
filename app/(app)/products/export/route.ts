import type { NextRequest } from "next/server";
import { filterProducts, getProducts, productFilters } from "@/lib/data";
import { productsCsv } from "@/lib/product-csv";

/** GET /products/export?q=&category=&status= : the Products page's current list as a CSV download. */
export async function GET(request: NextRequest) {
  const products = filterProducts(await getProducts(), productFilters(Object.fromEntries(request.nextUrl.searchParams)));
  return new Response(productsCsv(products), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="kassix-products-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store",
    },
  });
}
