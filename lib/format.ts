import type { PaymentMethod, Product, SalesReport } from "@/lib/database.types";

export const PAYMENT_METHODS: { value: PaymentMethod; label: string; color: string }[] = [
  { value: "cash", label: "Cash", color: "#008000" },
  { value: "card", label: "Card", color: "#000080" },
  { value: "gcash", label: "GCash", color: "#1084d0" },
  { value: "other", label: "Other", color: "#e8c547" },
];

export const paymentLabel = (method: string) =>
  PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;

// Two-decimal currencies only: prices are stored as numeric(12,2).
export const CURRENCIES = [
  "PHP", "USD", "EUR", "GBP", "AUD", "CAD", "NZD", "SGD", "HKD", "MYR", "THB", "INR", "CNY", "AED", "ZAR", "MXN", "BRL",
] as const;

const moneyFormats = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string) {
  let format = moneyFormats.get(currency);
  if (!format) {
    format = new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol" });
    moneyFormats.set(currency, format);
  }
  return format.format(amount);
}

export const formatNumber = (n: number) => new Intl.NumberFormat("en-US").format(n);

// Explicit locale and timezone keep server and browser output identical.
export function formatDateTime(iso: string, timeZone: string, style: "datetime" | "date" | "time" = "datetime") {
  const options: Intl.DateTimeFormatOptions =
    style === "date"
      ? { dateStyle: "medium" }
      : style === "time"
        ? { hour: "numeric", minute: "2-digit" }
        : { dateStyle: "medium", timeStyle: "short" };
  return new Intl.DateTimeFormat("en-US", { ...options, timeZone }).format(new Date(iso));
}

export function isValidTimezone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz.length > 0;
  } catch {
    return false;
  }
}

export type StockStatus = "out" | "low" | "ok";

export function stockStatus(p: Pick<Product, "stock_quantity" | "low_stock_threshold">): StockStatus {
  if (p.stock_quantity <= 0) return "out";
  return p.stock_quantity <= p.low_stock_threshold ? "low" : "ok";
}

export function formatCompactMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(amount);
}

const utcDay = (date: string) => new Date(`${date}T00:00:00Z`);
const dayFormat = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" });

const h12 = (hour: number) => `${hour % 12 || 12}${hour % 24 < 12 ? "am" : "pm"}`;

/** Chart points from a sales_report series; bucket times are already local wall-clock times. */
export function chartPoints(report: SalesReport) {
  const weekday = dayFormat({ weekday: "short" });
  const longDay = dayFormat({ weekday: "short", month: "short", day: "numeric" });
  return report.series.map(({ at, revenue, transactions }) => {
    const day = utcDay(at.slice(0, 10));
    const hour = Number(at.slice(11, 13));
    if (report.unit === "hour") return { label: h12(hour), title: `${h12(hour)} – ${h12(hour + 1)}`, revenue, transactions };
    const label = report.period === "month" ? String(day.getUTCDate()) : `${weekday.format(day)} ${day.getUTCDate()}`;
    return { label, title: longDay.format(day), revenue, transactions };
  });
}

/** "Tue, Sep 29" / "Sep 28 – Oct 4" / "September 2026" for a report's range. */
export function describePeriod(report: SalesReport) {
  const from = utcDay(report.from.slice(0, 10));
  const last = new Date(utcDay(report.to.slice(0, 10)).getTime() - 86_400_000);
  if (report.period === "today") return dayFormat({ weekday: "long", month: "long", day: "numeric" }).format(from);
  if (report.period === "month") return dayFormat({ month: "long", year: "numeric" }).format(from);
  const short = dayFormat({ weekday: "short", month: "short", day: "numeric" });
  return `${short.format(from)} – ${short.format(last)}`;
}
