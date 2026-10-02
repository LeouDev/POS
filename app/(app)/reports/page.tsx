import { ChartColumn, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PaymentBars, PaymentChart, SalesChart, SalesColumns } from "@/components/charts";
import { EmptyState, Kpi, Lcd } from "@/components/ui";
import { Window } from "@/components/window";
import { getProfile, getReport, param } from "@/lib/data";
import { chartPoints, describePeriod, formatMoney, PAYMENT_METHODS } from "@/lib/format";
import { PeriodSwitch, PeriodTabs } from "./period-switch";

export const metadata: Metadata = { title: "Reports" };

const PERIODS = ["today", "week", "month"] as const;
const PERIOD_NAMES = { today: "Today", week: "This week", month: "This month" };

export default async function ReportsPage(props: PageProps<"/reports">) {
  const sp = await props.searchParams;
  const period = PERIODS.find((p) => p === param(sp.period)) ?? "today";
  const [report, profile] = await Promise.all([getReport(period), getProfile()]);
  const money = (n: number) => formatMoney(n, profile.currency);
  const margin = report.net_sales > 0 ? Math.round((report.profit / report.net_sales) * 100) : 0;
  const methods = PAYMENT_METHODS.map((m) => {
    const row = report.by_payment.find((p) => p.method === m.value);
    return { method: m.value, label: m.label, total: row?.total ?? 0, count: row?.count ?? 0 };
  });

  const footnote = (
    <p className="text-[12px] text-neutral-600">
      Revenue is what customers paid after discounts, including tax. Estimated profit is revenue minus tax and each
      item&apos;s cost at the time of sale; margin is profit as a share of sales before tax. Weeks run Monday to Sunday
      in your timezone ({profile.timezone}).
    </p>
  );
  const noSales = (
    <EmptyState
      icon={ChartColumn}
      title="No sales in this period"
      action={
        <Link href="/sale" className="btn btn-default">
          <ShoppingCart aria-hidden size={16} /> New sale
        </Link>
      }
    >
      Charts and best sellers appear once sales are recorded.
    </EmptyState>
  );

  if (profile.ui_theme === "light" || profile.ui_theme === "dark") {
    return (
      <Window
        title="Reports"
        subtitle={`${PERIOD_NAMES[period]} · ${describePeriod(report)}`}
        toolbar={<PeriodTabs period={period} />}
        status={<span>{report.items_sold} units sold</span>}
      >
        <div className="flex flex-col gap-3.5 lg:gap-4">
          <section aria-label="Summary" className="grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:gap-3 xl:grid-cols-5">
            <Kpi label="Revenue" value={money(report.revenue)} valueClassName="text-[24px]" className="px-[18px] py-3.5" />
            <Kpi label="Est. cost" value={money(report.cost)} valueClassName="text-[24px]" className="px-[18px] py-3.5" />
            <Kpi
              label={`Est. profit · ${margin}% margin`}
              value={money(report.profit)}
              tone="good"
              valueClassName="text-[24px]"
              className="px-[18px] py-3.5"
            />
            <Kpi label="Transactions" value={report.transactions} valueClassName="text-[24px]" className="px-[18px] py-3.5" />
            <Kpi label="Avg. transaction" value={money(report.average)} valueClassName="text-[24px]" className="px-[18px] py-3.5" />
          </section>

          {report.transactions === 0 ? (
            noSales
          ) : (
            <>
              <section className="card px-[22px] py-[18px]">
                <h2 className="mb-3.5 text-[17px] font-semibold">{report.unit === "hour" ? "Sales by hour" : "Sales by day"}</h2>
                <SalesColumns
                  data={chartPoints(report)}
                  currency={profile.currency}
                  caption={report.unit === "hour" ? "Hour" : "Day"}
                />
              </section>
              <div className="grid gap-3.5 lg:grid-cols-2">
                <section className="card flex flex-col gap-3 px-[22px] py-[18px]">
                  <h2 className="text-[17px] font-semibold">Sales by payment method</h2>
                  <PaymentBars data={methods} currency={profile.currency} />
                </section>
                <section className="card min-w-0 px-[22px] pt-[18px] pb-1.5">
                  <h2 className="mb-2 text-[17px] font-semibold">Best-selling products</h2>
                  <div className="overflow-x-auto">
                    <table className="listview text-[14px]">
                      <thead>
                        <tr>
                          <th className="!pl-0">Product</th>
                          <th className="text-right">Sold</th>
                          <th className="text-right">Revenue</th>
                          <th className="hidden !pr-0 text-right sm:table-cell">Est. profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.top_products.map((p) => (
                          <tr key={p.product_id}>
                            <td className="!py-2 !pl-0">{p.name}</td>
                            <td className="!py-2 text-right tabular-nums">{p.quantity}</td>
                            <td className="!py-2 text-right tabular-nums">{money(p.revenue)}</td>
                            <td className="hidden !py-2 !pr-0 text-right text-[var(--green)] tabular-nums sm:table-cell">
                              {money(p.profit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}
          {footnote}
        </div>
      </Window>
    );
  }

  return (
    <Window
      title="Reports"
      icon={ChartColumn}
      status={
        <>
          <span className="flex-1">{describePeriod(report)}</span>
          <span>{report.items_sold} units sold</span>
        </>
      }
    >
      <PeriodSwitch period={period}>
        <div className="flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">{describePeriod(report)}</h2>
          <section aria-label="Summary" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
            <Lcd label="Revenue" value={money(report.revenue)} />
            <Lcd label="Est. cost" value={money(report.cost)} />
            <Lcd label={`Est. profit · ${margin}% margin`} value={money(report.profit)} />
            <Lcd label="Transactions" value={report.transactions} />
            <Lcd label="Avg. transaction" value={money(report.average)} />
          </section>

          {report.transactions === 0 ? (
            noSales
          ) : (
            <>
              <fieldset className="groupbox">
                <legend>{report.unit === "hour" ? "Sales by hour" : "Sales by day"}</legend>
                <SalesChart
                  data={chartPoints(report)}
                  currency={profile.currency}
                  caption={report.unit === "hour" ? "Hour" : "Day"}
                />
              </fieldset>
              <div className="grid gap-3 lg:grid-cols-2">
                <fieldset className="groupbox">
                  <legend>Sales by payment method</legend>
                  <PaymentChart data={methods} currency={profile.currency} />
                </fieldset>
                <fieldset className="groupbox min-w-0">
                  <legend>Best-selling products</legend>
                  <div className="sunken overflow-x-auto">
                    <table className="listview">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th className="text-right">Sold</th>
                          <th className="text-right">Revenue</th>
                          <th className="hidden text-right sm:table-cell">Est. profit</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.top_products.map((p) => (
                          <tr key={p.product_id}>
                            <td>{p.name}</td>
                            <td className="text-right tabular-nums">{p.quantity}</td>
                            <td className="text-right tabular-nums">{money(p.revenue)}</td>
                            <td className="hidden text-right tabular-nums sm:table-cell">{money(p.profit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </fieldset>
              </div>
            </>
          )}
          {footnote}
        </div>
      </PeriodSwitch>
    </Window>
  );
}
