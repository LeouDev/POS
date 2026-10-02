import { Download, ExternalLink, ReceiptText, Search, SearchX, ShoppingCart, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { FilterForm } from "@/components/filter-form";
import { Printable } from "@/components/printable";
import { Receipt } from "@/components/receipt";
import { cx, EmptyState, Pager, withParams } from "@/components/ui";
import { Window } from "@/components/window";
import { describeError } from "@/lib/actions";
import { getProfile, getSession, param } from "@/lib/data";
import { isIsoDate } from "@/lib/dates";
import { formatDateTime, formatMoney, PAYMENT_METHODS, paymentLabel } from "@/lib/format";
import { filterSales, itemsSummary, salesFilters } from "@/lib/sales";
import { PrintButton } from "./[id]/print-button";
import { VoidSaleButton } from "./[id]/void-sale";

export const metadata: Metadata = { title: "Sales" };

const PAGE_SIZE = 25;
// White/Black phones: the two export buttons share one row.
const PHONE_COMPACT = "ios:max-sm:!gap-1.5 ios:max-sm:!px-3 ios:max-sm:!text-[14px]";

export default async function SalesPage(props: PageProps<"/sales">) {
  const sp = await props.searchParams;
  const filters = salesFilters(sp);
  const { q, from, to, method } = filters;
  const page = Math.max(1, Math.floor(Number(param(sp.page))) || 1);
  const { supabase } = await getSession();
  const profileLoad = getProfile();
  // The timezone is only needed up front for date filters; otherwise profile and sales load together.
  const dated = isIsoDate(from) || isIsoDate(to);
  const zone = dated ? (await profileLoad).timezone : "UTC";
  // White/Black: the sale picked in the list (?sale=) shows its receipt beside it.
  const loadSale = (id: string) =>
    supabase
      .from("sales")
      .select("*, sale_items(*)")
      .eq("id", id)
      .order("product_name", { referencedTable: "sale_items" })
      .maybeSingle();
  const picked = z.uuid().safeParse(param(sp.sale)).success ? param(sp.sale) : "";
  const pickedLoad = picked ? loadSale(picked) : null;

  const query = supabase
    .from("sales")
    .select("id, receipt_number, created_at, total, payment_method, status, sale_items(product_name, quantity)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .order("product_name", { referencedTable: "sale_items" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const [{ data: sales, count, error }, profile] = await Promise.all([filterSales(query, filters, zone), profileLoad]);
  const tz = profile.timezone;
  const current = { q, from, to, method };
  if (error?.code === "PGRST103") redirect(withParams("/sales", current, {})); // page past the end
  if (error) throw new Error(describeError(error));

  const filtered = Boolean(q || method || from || to);
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);
  const exports = count ? (
    // Plain links: the route builds the file with the same filters as this list.
    <>
      <a
        href={withParams("/sales/export", current, {})}
        download
        className={`btn glass ${PHONE_COMPACT}`}
        title="One row per sale (CSV)"
      >
        <Download aria-hidden size={16} /> Export sales
      </a>
      <a
        href={withParams("/sales/export", current, { rows: "items" })}
        download
        className={`btn glass ${PHONE_COMPACT}`}
        title="One row per product sold (CSV)"
      >
        <Download aria-hidden size={16} /> Export products sold
      </a>
    </>
  ) : null;
  const empty = filtered ? (
    <EmptyState
      icon={SearchX}
      title="No sales match these filters"
      action={
        <Link href="/sales" className="btn">
          Clear filters
        </Link>
      }
    />
  ) : (
    <EmptyState
      icon={ReceiptText}
      title="No sales yet"
      action={
        <Link href="/sale" className="btn btn-default">
          <ShoppingCart aria-hidden size={16} /> New sale
        </Link>
      }
    >
      Completed sales show up here with their receipts.
    </EmptyState>
  );

  if (profile.ui_theme === "light" || profile.ui_theme === "dark") {
    // Wide screens always show a receipt (the newest until another is picked); phones open a picked one over the list.
    const { data: selected, error: saleError } =
      (await (pickedLoad ?? (sales?.[0] ? loadSale(sales[0].id) : null))) ?? {};
    if (saleError) throw new Error(describeError(saleError));
    const here = { ...current, page: page > 1 ? String(page) : "" };
    const capsule = "rounded-full !bg-[var(--card)]";
    return (
      <Window
        title="Sales"
        toolbar={exports}
        filters={
          <FilterForm key={JSON.stringify(sp)} action="/sales" className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Receipt no., e.g. R-000012"
              aria-label="Receipt number"
              className="field min-w-0 flex-1 basis-56"
            />
            <input
              type="date"
              name="from"
              defaultValue={from}
              max={to || undefined}
              aria-label="From"
              className={cx("field !w-auto", capsule)}
            />
            <input
              type="date"
              name="to"
              defaultValue={to}
              min={from || undefined}
              aria-label="To"
              className={cx("field !w-auto", capsule)}
            />
            <select name="method" defaultValue={method} aria-label="Payment" className={cx("field !w-auto", capsule)}>
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {filtered && (
              <Link href="/sales" className="btn">
                Clear
              </Link>
            )}
          </FilterForm>
        }
        bodyClassName="flex flex-col lg:overflow-hidden lg:!pr-3 lg:!pb-0"
      >
        {!sales?.length ? (
          empty
        ) : (
          <div className="flex min-h-0 flex-1 gap-3.5">
            <div className="sunken min-w-0 flex-1 lg:overflow-auto lg:rounded-b-none">
              <table className="listview">
                <thead>
                  <tr>
                    <th>Receipt</th>
                    <th>Date</th>
                    <th className="hidden sm:table-cell">Products</th>
                    <th className="hidden md:table-cell">Payment</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((s) => {
                    const products = itemsSummary(s.sale_items);
                    const voided = s.status === "voided";
                    const label2 = "text-[var(--label2)]";
                    return (
                      <tr key={s.id} data-href aria-selected={s.id === selected?.id || undefined} className="relative">
                        <td className="font-mono text-[14px] font-semibold whitespace-nowrap">
                          {/* Stretched link: the whole row picks the sale. */}
                          <Link
                            href={withParams("/sales", here, { sale: s.id })}
                            scroll={false}
                            className="text-inherit no-underline after:absolute after:inset-0"
                          >
                            {s.receipt_number}
                          </Link>
                        </td>
                        <td className={cx("text-[14px] whitespace-nowrap", label2)}>
                          {formatDateTime(s.created_at, tz)}
                          <span className="block text-[12px] md:hidden">
                            {paymentLabel(s.payment_method)}
                            {voided && <span className="font-semibold text-[var(--red)]"> · Voided</span>}
                          </span>
                        </td>
                        <td className={cx("hidden w-full max-w-0 truncate text-[14px] sm:table-cell", label2)} title={products}>
                          {voided && <span className="font-semibold text-[var(--red)]">Voided · </span>}
                          {products}
                        </td>
                        <td className="hidden text-[14px] md:table-cell">{paymentLabel(s.payment_method)}</td>
                        <td className="text-right text-[14px] font-semibold tabular-nums">
                          <span className={cx(voided && "line-through opacity-50")}>{formatMoney(s.total, profile.currency)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-2 pb-2">
                <Pager page={page} pages={pages} href={(n) => withParams("/sales", current, { page: n })} />
              </div>
            </div>

            {selected && (
              <aside
                aria-label={`Receipt ${selected.receipt_number}`}
                className={cx(
                  "relative flex-col lg:flex lg:w-[340px] lg:flex-none",
                  picked ? "max-lg:fixed max-lg:inset-0 max-lg:z-40 max-lg:flex max-lg:bg-[var(--bg)] max-lg:p-4" : "hidden",
                )}
              >
                <div className="flex items-center gap-3 pb-3 lg:hidden">
                  <Link
                    href={withParams("/sales", here, {})}
                    scroll={false}
                    aria-label="Back to sales"
                    className="glass grid size-10 place-items-center rounded-full !text-[var(--label)]"
                  >
                    <X aria-hidden size={18} />
                  </Link>
                  <h2 className="flex-1 text-center font-mono text-[17px] font-semibold">{selected.receipt_number}</h2>
                  <span className="size-10" />
                </div>
                <div className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-auto rounded-[22px] bg-[var(--fill)] px-4 pt-[22px] pb-24 lg:rounded-b-none">
                  {selected.status === "voided" && (
                    <p role="status" className="alert-box w-full max-w-[300px]">
                      <b>Voided</b>
                      {selected.voided_at && ` ${formatDateTime(selected.voided_at, tz)}`}
                      {selected.void_reason && `: ${selected.void_reason}`}.
                    </p>
                  )}
                  <Printable>
                    <Receipt sale={selected} businessName={profile.business_name} currency={profile.currency} timezone={tz} />
                  </Printable>
                </div>
                <div className="glass glass-group absolute inset-x-4 bottom-[max(24px,env(safe-area-inset-bottom))] justify-center lg:inset-x-auto lg:right-4 lg:bottom-6">
                  <PrintButton label="Print receipt" />
                  {selected.status !== "voided" && (
                    <VoidSaleButton
                      sale={{
                        id: selected.id,
                        receiptNumber: selected.receipt_number,
                        units: selected.sale_items.reduce((n, i) => n + i.quantity, 0),
                      }}
                    />
                  )}
                  <Link href={`/sales/${selected.id}`} className="btn" aria-label={`Details of ${selected.receipt_number}`} title="Details">
                    <ExternalLink aria-hidden size={16} />
                  </Link>
                </div>
              </aside>
            )}
          </div>
        )}
      </Window>
    );
  }

  return (
    <Window
      title="Sales"
      icon={ReceiptText}
      toolbar={
        <FilterForm key={JSON.stringify(sp)} action="/sales" className="flex flex-1 flex-wrap items-end gap-1.5">
          <label className="flex min-w-0 flex-1 basis-40 flex-col gap-0.5 text-[12px]">
            Receipt no.
            <input type="search" name="q" defaultValue={q} placeholder="e.g. R-000012" className="field" />
          </label>
          <label className="flex flex-1 basis-32 flex-col gap-0.5 text-[12px]">
            From
            <input type="date" name="from" defaultValue={from} max={to || undefined} className="field" />
          </label>
          <label className="flex flex-1 basis-32 flex-col gap-0.5 text-[12px]">
            To
            <input type="date" name="to" defaultValue={to} min={from || undefined} className="field" />
          </label>
          <label className="flex flex-1 basis-32 flex-col gap-0.5 text-[12px]">
            Payment
            <select name="method" defaultValue={method} className="field">
              <option value="">All methods</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-icon" aria-label="Search sales">
            <Search aria-hidden size={16} />
          </button>
          {filtered && (
            <Link href="/sales" className="btn">
              Clear
            </Link>
          )}
          {exports}
        </FilterForm>
      }
      status={
        <span className="flex-1">
          {count ?? 0} sale{count === 1 ? "" : "s"}
          {filtered ? (count === 1 ? " matches these filters" : " match these filters") : " recorded"}
        </span>
      }
    >
      {!sales?.length ? (
        empty
      ) : (
        <>
          <div className="sunken overflow-x-auto">
            <table className="listview">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>Date</th>
                  <th className="hidden sm:table-cell">Products</th>
                  <th className="hidden md:table-cell">Payment</th>
                  <th className="hidden md:table-cell">Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((s) => {
                  const products = itemsSummary(s.sale_items);
                  return (
                    <tr key={s.id} data-href className="relative">
                      <td className="font-mono font-bold">
                        {/* Stretched link: the whole row opens the receipt. */}
                        <Link href={`/sales/${s.id}`} className="text-inherit no-underline after:absolute after:inset-0">
                          {s.receipt_number}
                        </Link>
                      </td>
                      <td className="text-[13px]">
                        {formatDateTime(s.created_at, tz)}
                        <span className="block text-[12px] opacity-75 md:hidden">
                          {paymentLabel(s.payment_method)}
                          {s.status === "voided" && " · Voided"}
                        </span>
                        <span className="block max-w-[52vw] truncate text-[12px] opacity-75 sm:hidden">{products}</span>
                      </td>
                      <td className="hidden max-w-72 truncate text-[13px] sm:table-cell" title={products}>
                        {products}
                      </td>
                      <td className="hidden md:table-cell">{paymentLabel(s.payment_method)}</td>
                      <td className="hidden capitalize md:table-cell">{s.status}</td>
                      <td className={`text-right font-bold tabular-nums ${s.status === "voided" ? "line-through opacity-60" : ""}`}>
                        {formatMoney(s.total, profile.currency)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pager page={page} pages={pages} href={(n) => withParams("/sales", current, { page: n })} />
        </>
      )}
    </Window>
  );
}
