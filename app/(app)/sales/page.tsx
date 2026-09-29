import { Download, ReceiptText, Search, SearchX, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FilterForm } from "@/components/filter-form";
import { EmptyState, Pager, Window, withParams } from "@/components/ui";
import { describeError } from "@/lib/actions";
import { getProfile, getSession, param } from "@/lib/data";
import { isIsoDate } from "@/lib/dates";
import { formatDateTime, formatMoney, PAYMENT_METHODS, paymentLabel } from "@/lib/format";
import { filterSales, itemsSummary, salesFilters } from "@/lib/sales";

export const metadata: Metadata = { title: "Sales" };

const PAGE_SIZE = 25;

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
          {count ? (
            // Plain links: the route builds the file with the same filters as this list.
            <>
              <a href={withParams("/sales/export", current, {})} download className="btn" title="One row per sale (CSV)">
                <Download aria-hidden size={16} /> Export sales
              </a>
              <a
                href={withParams("/sales/export", current, { rows: "items" })}
                download
                className="btn"
                title="One row per product sold (CSV)"
              >
                <Download aria-hidden size={16} /> Export products sold
              </a>
            </>
          ) : null}
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
        filtered ? (
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
        )
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
                        <span className="block text-[12px] opacity-75 md:hidden">{paymentLabel(s.payment_method)}</span>
                        <span className="block max-w-[52vw] truncate text-[12px] opacity-75 sm:hidden">{products}</span>
                      </td>
                      <td className="hidden max-w-72 truncate text-[13px] sm:table-cell" title={products}>
                        {products}
                      </td>
                      <td className="hidden md:table-cell">{paymentLabel(s.payment_method)}</td>
                      <td className="hidden capitalize md:table-cell">{s.status}</td>
                      <td className="text-right font-bold tabular-nums">{formatMoney(s.total, profile.currency)}</td>
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
