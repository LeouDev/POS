import { ChartColumn, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PaymentChart, SalesChart } from "@/components/charts";
import { EmptyState, Lcd, Window } from "@/components/ui";
import { getProfile, getReport, param } from "@/lib/data";
import { chartPoints, describePeriod, formatMoney, PAYMENT_METHODS } from "@/lib/format";
import { PeriodSwitch } from "./period-switch";

export const metadata: Metadata = { title: "Reports" };

const PERIODS = ["today", "week", "month"] as const;

export default async function ReportsPage(props: PageProps<"/reports">) {
  const sp = await props.searchParams;
  const period = PERIODS.find((p) => p === param(sp.period)) ?? "today";
  const [report, profile] = await Promise.all([getReport(period), getProfile()]);
  const money = (n: number) => formatMoney(n, profile.currency);
  const margin = report.net_sales > 0 ? Math.round((report.profit / report.net_sales) * 100) : 0;
  const methods = PAYMENT_METHODS.map((m) => {
    const row = report.by_payment.find((p) => p.method === m.value);
    return { label: m.label, total: row?.total ?? 0, count: row?.count ?? 0 };
  });

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
          <p className="text-[12px] text-neutral-600">
            Revenue is what customers paid after discounts, including tax. Estimated profit is revenue minus tax and
            each item&apos;s cost at the time of sale; margin is profit as a share of sales before tax. Weeks run Monday
            to Sunday in your timezone ({profile.timezone}).
          </p>
        </div>
      </PeriodSwitch>
    </Window>
  );
}
