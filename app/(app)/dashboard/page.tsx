import {
  ChartColumn,
  ChevronRight,
  LayoutDashboard,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  ShoppingCart,
  Trophy,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SalesChart, SalesColumns } from "@/components/charts";
import { PlanChip } from "@/components/trial";
import { Kpi, Lcd, StockBadge } from "@/components/ui";
import { Window } from "@/components/window";
import { describeError } from "@/lib/actions";
import { getProfile, getReport, getSession } from "@/lib/data";
import { chartPoints, describePeriod, formatDateTime, formatMoney, initials, paymentLabel } from "@/lib/format";
import { accessEndsAt, isPro, TRIAL_DAYS, trialEndsAt } from "@/lib/trial";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { supabase } = await getSession();
  const [profile, today, week, recent, low, catalogue] = await Promise.all([
    getProfile(),
    getReport("today"),
    getReport("7d"),
    supabase
      .from("sales")
      .select("id, receipt_number, created_at, total, payment_method")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(6),
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

  if (profile.ui_theme === "light" || profile.ui_theme === "dark") {
    return (
      <Window
        title="Dashboard"
        eyebrow={<span className="max-lg:hidden">Today, {describePeriod(today)}</span>}
        subtitle={<span className="lg:hidden">{profile.business_name} · Today</span>}
        toolbar={
          <>
            <Link href="/reports" className="btn glass max-lg:!hidden">
              <ChartColumn aria-hidden size={17} /> Reports
            </Link>
            <Link href="/sale" className="btn btn-default !px-[18px] max-lg:!hidden">
              <ShoppingCart aria-hidden size={17} /> New sale
            </Link>
            <PlanChip
              endsAt={accessEndsAt(profile)}
              pro={isPro(profile)}
              short
              className="glass h-10 gap-1.5 rounded-full px-3.5 lg:!hidden"
            />
            <Link
              href="/settings"
              aria-label="Settings"
              className="grid size-10 place-items-center rounded-full bg-[var(--tint)] text-[13px] font-bold !text-white no-underline lg:hidden"
            >
              {initials(profile.business_name)}
            </Link>
          </>
        }
      >
        <div className="flex flex-col gap-2.5 lg:gap-3.5">
          {!hasSales && (
            <GettingStarted
              hasProducts={hasProducts}
              trialEnds={formatDateTime(trialEndsAt(profile), profile.timezone, "date")}
            />
          )}

          <section aria-label="Today" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-3.5">
            <Kpi
              label="Today's sales"
              value={money(today.revenue)}
              className="max-lg:col-span-2 max-lg:rounded-[24px] max-lg:px-[18px]"
              valueClassName="text-[40px] tracking-[-0.03em] lg:text-[30px] lg:tracking-[-0.02em]"
            />
            <Kpi
              label="Transactions"
              value={today.transactions}
              className="max-lg:px-4 max-lg:py-3.5"
              valueClassName="text-[24px] lg:text-[30px]"
            />
            <Kpi label="Avg. sale" value={money(today.average)} className="max-lg:hidden" />
            <Kpi
              label="Est. profit"
              value={money(today.profit)}
              tone="good"
              className="max-lg:px-4 max-lg:py-3.5"
              valueClassName="text-[24px] lg:text-[30px]"
            />
          </section>

          <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-3.5">
            <section className="card flex flex-col gap-3 px-[18px] py-4 max-lg:rounded-[24px] lg:gap-3.5 lg:px-5 lg:py-[18px]">
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="text-[15px] font-semibold lg:text-[17px]">Sales, last 7 days</h2>
                {week.transactions > 0 && (
                  <span className="text-[13px] text-[var(--label2)] max-lg:hidden">{money(week.revenue)} total</span>
                )}
              </div>
              {week.transactions === 0 ? (
                <IosEmpty>No sales in the last 7 days. The chart fills in as you sell.</IosEmpty>
              ) : (
                <SalesColumns data={chartPoints(week)} currency={profile.currency} caption="Day" recent />
              )}
            </section>
            <IosPanel title="Top sellers, last 7 days">
              {week.top_products.length === 0 ? (
                <IosEmpty>No sales in the last 7 days.</IosEmpty>
              ) : (
                <table className="listview">
                  <thead>
                    <tr>
                      <th className="!pl-0">Product</th>
                      <th className="text-right">Sold</th>
                      <th className="!pr-0 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.top_products.map((p) => (
                      <tr key={p.product_id}>
                        <td className="!pl-0">{p.name}</td>
                        <td className="text-right tabular-nums">{p.quantity}</td>
                        <td className="!pr-0 text-right tabular-nums">{money(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </IosPanel>
          </div>

          <div className="grid gap-2.5 lg:grid-cols-2 lg:gap-3.5">
            <IosPanel title="Recent sales" more={hasSales ? { href: "/sales", label: "All sales" } : undefined}>
              {!hasSales ? (
                <IosEmpty>
                  No sales yet. <Link href="/sale">Ring up the first one.</Link>
                </IosEmpty>
              ) : (
                <ul>
                  {(recent.data ?? []).map((s) => (
                    <li key={s.id} className="border-t-[0.5px] border-[var(--sep)]">
                      <Link
                        href={`/sales/${s.id}`}
                        className="flex min-h-11 items-center gap-3 py-[9px] !text-[var(--label)] no-underline"
                      >
                        <span className="flex min-w-0 flex-1 flex-col lg:flex-row lg:items-baseline lg:gap-3">
                          <span className="font-mono text-[15px] font-semibold lg:text-[14px]">{s.receipt_number}</span>
                          <span className="truncate text-[13px] text-[var(--label2)]">
                            {formatDateTime(s.created_at, tz)} · {paymentLabel(s.payment_method)}
                          </span>
                        </span>
                        <span className="text-[16px] font-semibold tabular-nums lg:text-[15px]">{money(s.total)}</span>
                        <ChevronRight aria-hidden size={14} className="flex-none text-[var(--label3)]" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </IosPanel>
            <IosPanel
              title={`Low stock${low.count ? ` (${low.count})` : ""}`}
              more={low.count ? { href: "/inventory?level=low", label: "Restock" } : undefined}
            >
              {!low.data?.length ? (
                <IosEmpty>{hasProducts ? "Everything is well stocked." : "Add products to track stock levels."}</IosEmpty>
              ) : (
                <ul>
                  {low.data.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 border-t-[0.5px] border-[var(--sep)] py-[9px]">
                      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{p.name}</span>
                      <span className="text-[13px] whitespace-nowrap text-[var(--label2)]">
                        {p.stock_quantity} left · alert at {p.low_stock_threshold}
                      </span>
                      <StockBadge product={p} />
                    </li>
                  ))}
                </ul>
              )}
            </IosPanel>
          </div>
        </div>
      </Window>
    );
  }

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
        {!hasSales && (
          <GettingStarted
            hasProducts={hasProducts}
            trialEnds={formatDateTime(trialEndsAt(profile), profile.timezone, "date")}
          />
        )}

        <section aria-label="Today" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          <Lcd label="Today's sales" value={money(today.revenue)} />
          <Lcd label="Transactions" value={today.transactions} />
          <Lcd label="Avg. sale" value={money(today.average)} />
          <Lcd label="Est. profit" value={money(today.profit)} />
        </section>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <fieldset className="groupbox">
            <legend>Sales, last 7 days</legend>
            {week.transactions === 0 ? (
              <div className="sunken">
                <Empty>No sales in the last 7 days. The chart fills in as you sell.</Empty>
              </div>
            ) : (
              <SalesChart data={chartPoints(week)} currency={profile.currency} caption="Day" />
            )}
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

function IosPanel({ title, more, children }: { title: string; more?: { href: string; label: string }; children: ReactNode }) {
  return (
    <section className="card flex min-w-0 flex-col px-5 pt-[18px] pb-1.5 max-lg:rounded-[24px]">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        {more && (
          <Link href={more.href} className="text-[15px]">
            {more.label}
          </Link>
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

const IosEmpty = ({ children }: { children: ReactNode }) => (
  <p className="flex min-h-24 items-center justify-center p-4 text-center text-[13px] text-[var(--label2)]">{children}</p>
);

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="flex min-h-24 items-center justify-center p-4 text-center text-[13px] text-neutral-600">{children}</p>
);

function GettingStarted({ hasProducts, trialEnds }: { hasProducts: boolean; trialEnds: string }) {
  return (
    <fieldset className="groupbox !bg-tip ios:!bg-[color-mix(in_srgb,var(--tint)_10%,var(--card))]">
      <legend>Getting started</legend>
      <p className="mb-2 text-[13px]">
        Welcome to KASSIX! Your <b>{TRIAL_DAYS}-day free trial</b> runs until <b>{trialEnds}</b>. Every feature is
        included.
      </p>
      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <li className="flex items-center gap-2">
          <span
            className={`grid size-6 flex-none place-items-center border border-black text-[12px] font-bold ios:rounded-full ios:border-0 ${hasProducts ? "bg-ok text-white" : "bg-white ios:bg-[var(--fill)]"}`}
          >
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
          <span className="grid size-6 flex-none place-items-center border border-black bg-white text-[12px] font-bold ios:rounded-full ios:border-0 ios:bg-[var(--fill)]">
            2
          </span>
          <Link href="/sale" className={`btn btn-sm ${hasProducts ? "btn-default" : ""}`}>
            <ShoppingCart aria-hidden size={16} /> Make your first sale
          </Link>
        </li>
        <li className="text-[13px] text-neutral-700">Your numbers show up here as soon as you sell.</li>
      </ol>
    </fieldset>
  );
}
