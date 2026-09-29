import { toCsv } from "@/lib/csv";
import { param } from "@/lib/data";
import type { PaymentMethod, Sale } from "@/lib/database.types";
import { addDays, isIsoDate, zonedDayStart } from "@/lib/dates";
import { PAYMENT_METHODS, paymentLabel } from "@/lib/format";

export type SalesFilters = { q: string; from: string; to: string; method: PaymentMethod | "" };

/** The Sales page's filters from its search params (shared with the CSV export). */
export function salesFilters(sp: Record<string, string | string[] | undefined>): SalesFilters {
  return {
    q: param(sp.q).replace(/[%*,()"\\]/g, "").trim().slice(0, 30),
    from: param(sp.from),
    to: param(sp.to),
    method: PAYMENT_METHODS.find((m) => m.value === param(sp.method))?.value ?? "",
  };
}

type Filterable<T> = {
  ilike(column: string, pattern: string): T;
  eq(column: string, value: string): T;
  gte(column: string, value: string): T;
  lt(column: string, value: string): T;
};

/** Applies the filters to a sales query; dates are whole days in the business timezone. */
export function filterSales<T extends Filterable<T>>(query: T, f: SalesFilters, timezone: string): T {
  let q = query;
  if (f.q) q = q.ilike("receipt_number", `%${f.q}%`);
  if (f.method) q = q.eq("payment_method", f.method);
  if (isIsoDate(f.from)) q = q.gte("created_at", zonedDayStart(f.from, timezone).toISOString());
  if (isIsoDate(f.to)) q = q.lt("created_at", zonedDayStart(addDays(f.to, 1), timezone).toISOString());
  return q;
}

/** "2 x Iced Coffee; 1 x Ensaymada", like the receipt's lines (pass items in the order to show). */
export const itemsSummary = (items: { product_name: string; quantity: number }[]) =>
  items.map((i) => `${i.quantity} x ${i.product_name}`).join("; ");

export type ExportSale = Pick<
  Sale,
  "receipt_number" | "created_at" | "subtotal" | "discount" | "tax" | "total" | "payment_method" | "status"
> & { sale_items: { product_name: string; quantity: number; unit_cost: number }[] };

const cents = (n: number) => Math.round(n * 100) / 100;

/** One row per sale, amounts as plain numbers so spreadsheets can add them up. Profit is as in Reports. */
export function salesCsv(sales: ExportSale[], timezone: string, currency: string) {
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const money = (label: string) => `${label} (${currency})`;
  const header = [
    "Receipt no.",
    "Date",
    "Time",
    "Products",
    "Items",
    money("Subtotal"),
    money("Discount"),
    money("Tax"),
    money("Total"),
    money("Cost"),
    money("Profit"),
    "Payment",
    "Status",
  ];
  const rows = sales.map((s) => {
    const at = new Date(s.created_at);
    const cost = cents(s.sale_items.reduce((sum, i) => sum + i.quantity * i.unit_cost, 0));
    return [
      s.receipt_number,
      day.format(at),
      time.format(at),
      itemsSummary(s.sale_items),
      s.sale_items.reduce((sum, i) => sum + i.quantity, 0),
      s.subtotal,
      s.discount,
      s.tax,
      s.total,
      cost,
      cents(s.subtotal - s.discount - cost),
      paymentLabel(s.payment_method),
      s.status === "voided" ? "Voided" : "Completed",
    ];
  });
  return toCsv([header, ...rows]);
}
