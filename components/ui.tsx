import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { stockStatus } from "@/lib/format";
import type { Product } from "@/lib/database.types";

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(" ");

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx("pixel font-bold tracking-wider text-navy", className)}>
      KASSI<span className="text-brand">X</span>
    </span>
  );
}

/** Title bar with decorative window buttons; pass children to replace them (e.g. a real close button). */
export function TitleBar({
  title,
  icon: Icon,
  id,
  as: Heading = "h1",
  children,
}: {
  title: ReactNode;
  icon?: LucideIcon;
  id?: string;
  as?: "h1" | "h2";
  children?: ReactNode;
}) {
  return (
    <div className="titlebar">
      {Icon && <Icon aria-hidden size={16} strokeWidth={2.25} className="flex-none" />}
      <Heading id={id} className="min-w-0 flex-1 truncate text-[14px] ios:text-center ios:text-[17px]">
        {title}
      </Heading>
      {children ?? (
        <div aria-hidden className="hidden gap-0.5 sm:flex ios:!hidden">
          <span className="titlebar-button">_</span>
          <span className="titlebar-button">□</span>
          <span className="titlebar-button">×</span>
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: LucideIcon;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
      <div className="raised grid size-14 place-items-center bg-face">
        <Icon aria-hidden size={28} className="text-navy" />
      </div>
      <p className="text-[15px] font-bold">{title}</p>
      {children && <div className="max-w-sm text-[13px] text-neutral-700">{children}</div>}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("skeleton", className)} />;
}

const STOCK_STYLES = {
  out: { label: "Out of stock", className: "bg-maroon text-white ios:text-[var(--red)]" },
  low: { label: "Low stock", className: "bg-folder text-black ios:text-[var(--orange)]" },
  ok: { label: "In stock", className: "bg-ok text-white ios:text-[var(--green)]" },
} as const;

/** White/Black: a tinted pill in the text colour (pair with an ios:text-[…] colour). */
export const IOS_PILL =
  "ios:inline-flex ios:h-[22px] ios:items-center ios:rounded-full ios:border-0 ios:bg-[color-mix(in_srgb,currentColor_15%,transparent)] ios:px-2 ios:py-0 ios:font-semibold";

export function StockBadge({ product }: { product: Pick<Product, "stock_quantity" | "low_stock_threshold"> }) {
  const s = STOCK_STYLES[stockStatus(product)];
  return (
    <span className={cx("inline-block border border-black px-1.5 py-px text-[11px] font-bold whitespace-nowrap", IOS_PILL, s.className)}>
      {s.label}
    </span>
  );
}

/** Label + control + error message, wired up for screen readers via fieldIds(). */
export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className="text-[13px]">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-[12px] font-bold text-brand">
          {error}
        </p>
      ) : (
        hint && <p className="text-[12px] text-neutral-600">{hint}</p>
      )}
    </div>
  );
}

export const fieldIds = (id: string, error?: string) => ({
  id,
  "aria-invalid": error ? true : undefined,
  "aria-describedby": error ? `${id}-error` : undefined,
});

export function Lcd({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <fieldset className={cx("groupbox !pt-1", className)}>
      <legend className="!font-normal">{label}</legend>
      <div className="lcd text-right text-[22px] sm:text-[34px] xl:text-[38px]">{value}</div>
    </fieldset>
  );
}

const TONES = { good: "text-[var(--green)]", warn: "text-[var(--orange)]", bad: "text-[var(--red)]" };

/** White/Black: a figure on a card (the original look uses Lcd). */
export function Kpi({
  label,
  value,
  tone,
  className,
  valueClassName = "text-[30px]",
}: {
  label: string;
  value: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
  valueClassName?: string;
}) {
  return (
    <div className={cx("card min-w-0 px-5 py-4", className)}>
      <p className="text-[13px] font-medium text-[var(--label2)]">{label}</p>
      <p className={cx("mt-1 leading-[1.15] font-bold tracking-[-0.02em] tabular-nums [overflow-wrap:anywhere]", tone && TONES[tone], valueClassName)}>
        {value}
      </p>
    </div>
  );
}

/** Builds a URL keeping the current filters, with some params replaced (empty values are dropped). */
export function withParams(base: string, current: Record<string, string>, changes: Record<string, string | number>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...changes })) if (v !== "" && v !== undefined) qs.set(k, String(v));
  const query = qs.toString();
  return query ? `${base}?${query}` : base;
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  const link = (target: number, label: string, icon: ReactNode, enabled: boolean) =>
    enabled ? (
      <Link href={href(target)} className="btn" aria-label={label}>
        {icon}
      </Link>
    ) : (
      <span className="btn" aria-disabled="true" aria-label={label}>
        {icon}
      </span>
    );
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2 pt-3">
      {link(page - 1, "Previous page", <ChevronLeft aria-hidden size={16} />, page > 1)}
      <span className="text-[13px]">
        Page {page} of {pages}
      </span>
      {link(page + 1, "Next page", <ChevronRight aria-hidden size={16} />, page < pages)}
    </nav>
  );
}
