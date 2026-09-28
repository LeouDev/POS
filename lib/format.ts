import type { PaymentMethod, Product } from "@/lib/database.types";

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
