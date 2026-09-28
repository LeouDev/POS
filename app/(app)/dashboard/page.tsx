import { ChartColumn, LayoutDashboard, PackageCheck, PackagePlus, ReceiptText, ShoppingCart, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SalesChart } from "@/components/charts";
import { Lcd, StockBadge, Window } from "@/components/ui";
import { describeError } from "@/lib/actions";
import { getProfile, getReport, getSession } from "@/lib/data";
import { chartPoints, describePeriod, formatDateTime, formatMoney, paymentLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase } = await getSession();
  const [profile, today, week, recent, low, catalogue] = await Promise.all([
    getProfile(),
    getReport("today"),
    getReport("7d"),
    supabase.from("sales").select("id, receipt_number, created_at, total, payment_method").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("products")
      .select("id, name, stock_quantity, low_stock_threshold", { count: "exact" })
      .eq("is_active", true)
      .eq("is_low_stock", true)
      .order("stock_quantity")
      .limit(6),
    supabase.from("products").select("id", { count: "exact", head: true }),
  ]);
  for (const r of [recent, low, catalogue]) if (r.error) throw new Error(describeError(r.error));

  const money = (n: number) => formatMoney(n, profile.currency);
  const tz = profile.timezone;
  const hasProducts = (catalogue.count ?? 0) > 0;
  const hasSales = (recent.data?.length ?? 0) > 0;

  return (
    <Window
      title={`Dashboard - ${profile.business_name}`}
      icon={LayoutDashboard}
      toolbar={
        <>
          <Link href="/sale" className="btn btn-default">
            <ShoppingCart aria-hidden size={16} className="text-ok" /> New sale
          </Link>
          <Link href="/reports" className="btn">
            <ChartColumn aria-hidden size={16} /> Reports
          </Link>
          <span className="ml-auto px-2 text-[13px]">{describePeriod(today)}</span>
        </>
      }
      status={
        <>
          <span className="flex-1">Store: {profile.business_name}</span>
          <span className="hidden sm:block">Timezone: {tz.replaceAll("_", " ")}</span>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {!hasSales && <GettingStarted hasProducts={hasProducts} />}

        <section aria-label="Today" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Lcd label="Today's sales" value={money(today.revenue)} />
          <Lcd label="Transactions" value={today.transactions} />
          <Lcd label="Avg. sale" value={money(today.average)} />
          <Lcd label="Est. profit" value={money(today.profit)} />
        </section>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <fieldset className="groupbox">
            <legend>Sales, last 7 days</legend>
            <SalesChart data={chartPoints(week)} currency={profile.currency} caption="Day" />
          </fieldset>
          <Panel title="Top sellers, last 7 days" icon={Trophy}>
            {week.top_products.length === 0 ? (
              <Empty>No sales in the last 7 days.</Empty>
            ) : (
              <table className="listview">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="text-right">Sold</th>
                    <th className="text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {week.top_products.map((p) => (
                    <tr key={p.product_id}>
                      <td>{p.name}</td>
                      <td className="text-right tabular-nums">{p.quantity}</td>
                      <td className="text-right tabular-nums">{money(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title="Recent sales" icon={ReceiptText} more={hasSales ? { href: "/sales", label: "All sales" } : undefined}>
            {!hasSales ? (
              <Empty>
                No sales yet. <Link href="/sale">Ring up the first one.</Link>
              </Empty>
            ) : (
              <table className="listview">
                <tbody>
                  {(recent.data ?? []).map((s) => (
                    <tr key={s.id} data-href className="relative">
                      <td className="font-mono font-bold">
                        <Link href={`/sales/${s.id}`} className="text-inherit no-underline after:absolute after:inset-0">
                          {s.receipt_number}
                        </Link>
                      </td>
                      <td className="text-[12px]">
                        {formatDateTime(s.created_at, tz)}
                        <span className="block opacity-75">{paymentLabel(s.payment_method)}</span>
                      </td>
                      <td className="text-right font-bold tabular-nums">{money(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
          <Panel
            title={`Low stock${low.count ? ` (${low.count})` : ""}`}
            icon={PackageCheck}
            more={low.count ? { href: "/inventory?level=low", label: "Restock" } : undefined}
          >
            {!low.data?.length ? (
              <Empty>{hasProducts ? "Everything is well stocked." : "Add products to track stock levels."}</Empty>
            ) : (
              <table className="listview">
                <tbody>
                  {low.data.map((p) => (
                    <tr key={p.id}>
                      <td className="font-bold">{p.name}</td>
                      <td className="text-right text-[12px] whitespace-nowrap">
                        <b className="text-[14px] tabular-nums">{p.stock_quantity}</b> left · alert at {p.low_stock_threshold}
                      </td>
                      <td className="text-right">
                        <StockBadge product={p} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>
        </div>
      </div>
    </Window>
  );
}

function Panel({
  title,
  icon: Icon,
  more,
  children,
}: {
  title: string;
  icon: typeof Trophy;
  more?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <fieldset className="groupbox flex min-w-0 flex-col gap-2">
      <legend className="flex items-center gap-1.5">
        <Icon aria-hidden size={15} /> {title}
      </legend>
      <div className="sunken min-h-24 overflow-x-auto">{children}</div>
      {more && (
        <Link href={more.href} className="self-end text-[13px]">
          {more.label} ›
        </Link>
      )}
    </fieldset>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="flex min-h-24 items-center justify-center p-4 text-center text-[13px] text-neutral-600">{children}</p>
);

function GettingStarted({ hasProducts }: { hasProducts: boolean }) {
  return (
    <fieldset className="groupbox !bg-tip">
      <legend>Getting started</legend>
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <li className="flex items-center gap-2">
          <span className={`grid size-6 flex-none place-items-center border border-black text-[12px] font-bold ${hasProducts ? "bg-ok text-white" : "bg-white"}`}>
            {hasProducts ? "✓" : "1"}
          </span>
          {hasProducts ? (
            "Products added"
          ) : (
            <Link href="/products" className="btn btn-sm">
              <PackagePlus aria-hidden size={16} /> Add your products
            </Link>
          )}
        </li>
        <li className="flex items-center gap-2">
          <span className="grid size-6 flex-none place-items-center border border-black bg-white text-[12px] font-bold">2</span>
          <Link href="/sale" className={`btn btn-sm ${hasProducts ? "btn-default" : ""}`}>
            <ShoppingCart aria-hidden size={16} /> Make your first sale
          </Link>
        </li>
        <li className="text-[13px] text-neutral-700">Your numbers show up here as soon as you sell.</li>
      </ol>
    </fieldset>
  );
}
