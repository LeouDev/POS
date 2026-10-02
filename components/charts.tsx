"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { cx } from "@/components/ui";
import type { PaymentMethod } from "@/lib/database.types";
import { formatCompactMoney, formatMoney } from "@/lib/format";

// One series, one hue: the theme's title-bar blue (passes the palette checks on white);
// the hovered bar darkens to navy. Axes and labels stay in text colours.
const FILL = "#1084d0";
const ACTIVE = "#000080";
const GRID = "#e4e4e4";
const AXIS_TEXT = { fontSize: 11, fill: "#333" };

type Point = { label: string; title: string; revenue: number; transactions: number };

function PointTooltip({ active, payload, currency }: Partial<TooltipContentProps<number, string>> & { currency: string }) {
  const point = payload?.[0]?.payload as Point | undefined;
  if (!active || !point) return null;
  return (
    <div className="border border-black bg-tip px-2 py-1 text-[12px] shadow-[2px_2px_0_rgb(0_0_0/0.3)]">
      <div className="text-[13px] font-bold">{formatMoney(point.revenue, currency)}</div>
      <div>{point.title}</div>
      <div className="text-neutral-700">
        {point.transactions} sale{point.transactions === 1 ? "" : "s"}
      </div>
    </div>
  );
}

/** Sales per hour or day as columns, with a table-view twin for screen readers and exact values. */
export function SalesChart({ data, currency, caption }: { data: Point[]; currency: string; caption: string }) {
  return (
    <figure className="flex flex-col gap-2">
      <div className="sunken h-64 px-1 pt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: "#808080" }}
              tick={AXIS_TEXT}
              interval="preserveStartEnd"
              minTickGap={6}
            />
            <YAxis
              width={58}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TEXT}
              allowDecimals={false}
              tickFormatter={(v: number) => formatCompactMoney(v, currency)}
            />
            <Tooltip cursor={{ fill: ACTIVE, fillOpacity: 0.06 }} content={<PointTooltip currency={currency} />} />
            <Bar dataKey="revenue" name="Sales" fill={FILL} activeBar={{ fill: ACTIVE }} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      <details className="text-[13px]">
        <summary className="cursor-pointer select-none">View as table</summary>
        <div className="sunken mt-2 max-h-56 overflow-y-auto">
          <table className="listview">
            <thead>
              <tr>
                <th>{caption}</th>
                <th className="text-right">Sales</th>
                <th className="text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.title}>
                  <td>{p.title}</td>
                  <td className="text-right tabular-nums">{p.transactions}</td>
                  <td className="text-right tabular-nums">{formatMoney(p.revenue, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

type MethodRow = { method: PaymentMethod; label: string; total: number; count: number };

/** Revenue by payment method as horizontal bars with values at the tips, plus the exact table. */
export function PaymentChart({ data, currency }: { data: MethodRow[]; currency: string }) {
  const grand = data.reduce((sum, d) => sum + d.total, 0);
  return (
    <figure className="flex flex-col gap-2">
      <div className="sunken px-1" style={{ height: data.length * 40 + 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ top: 8, right: 84, bottom: 8, left: 0 }}>
            <XAxis type="number" hide domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="label"
              width={60}
              tickLine={false}
              axisLine={{ stroke: "#808080" }}
              tick={{ ...AXIS_TEXT, fontSize: 12, fill: "#000" }}
            />
            <Bar dataKey="total" fill={FILL} activeBar={{ fill: ACTIVE }} maxBarSize={24} isAnimationActive={false}>
              <LabelList
                dataKey="total"
                position="right"
                formatter={(v) => formatMoney(Number(v), currency)}
                style={{ fontSize: 12, fill: "#000" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="listview">
        <thead>
          <tr>
            <th>Method</th>
            <th className="text-right">Sales</th>
            <th className="text-right">Revenue</th>
            <th className="text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <td>{d.label}</td>
              <td className="text-right tabular-nums">{d.count}</td>
              <td className="text-right tabular-nums">{formatMoney(d.total, currency)}</td>
              <td className="text-right tabular-nums">{grand ? Math.round((d.total / grand) * 100) : 0}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// ---- White / Black (iOS) charts: plain columns and bars, hover for values, a table for exact figures.

/** Rounds a chart's top up to 1, 2, 2.5 or 5 × 10ⁿ, so axis labels read ₱5k / ₱2.5k / ₱0. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= value) ?? 10 * p;
}

function ValuesTable({ data, currency, caption }: { data: Point[]; currency: string; caption: string }) {
  return (
    <details className="text-[13px]">
      <summary className="cursor-pointer text-[var(--tint)] select-none">View as table</summary>
      <div className="mt-2 max-h-56 overflow-y-auto">
        <table className="listview">
          <thead>
            <tr>
              <th>{caption}</th>
              <th className="text-right">Sales</th>
              <th className="text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.title}>
                <td>{p.title}</td>
                <td className="text-right tabular-nums">{p.transactions}</td>
                <td className="text-right tabular-nums">{formatMoney(p.revenue, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/**
 * Sales per day or hour as columns. `recent` is the dashboard's version: earlier days faded, the last
 * (today) solid and labelled "Today"; otherwise all solid with a value axis, as in Reports.
 */
export function SalesColumns({
  data,
  currency,
  caption,
  recent,
}: {
  data: Point[];
  currency: string;
  caption: string;
  recent?: boolean;
}) {
  const max = niceMax(Math.max(0, ...data.map((p) => p.revenue)));
  const n = data.length;
  const every = Math.ceil(n / 8); // label at most ~8 columns
  const columns = { gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` };
  const gap = n > 16 ? "gap-1" : n > 7 ? "gap-2" : recent ? "gap-[9px] lg:gap-3.5" : "gap-[22px]";
  const label = (p: Point, i: number) => (recent ? (i === n - 1 ? "Today" : p.label.split(" ")[0]) : p.label);

  return (
    <figure className="flex flex-col gap-2">
      <div className={cx("grid gap-y-2", !recent && "grid-cols-[44px_minmax(0,1fr)] gap-x-2.5")}>
        {!recent && (
          <div aria-hidden className="flex h-[170px] flex-col justify-between text-right text-[11px] leading-none text-[var(--label2)]">
            <span>{formatCompactMoney(max, currency)}</span>
            <span>{formatCompactMoney(max / 2, currency)}</span>
            <span>{formatCompactMoney(0, currency)}</span>
          </div>
        )}
        <div
          className={cx(
            "grid items-end",
            gap,
            recent
              ? "h-[90px] lg:h-[190px] lg:border-b-[0.5px] lg:border-[var(--sep)]"
              : "h-[170px] [background:linear-gradient(var(--sep),var(--sep))_top/100%_0.5px_no-repeat,linear-gradient(var(--sep),var(--sep))_center/100%_0.5px_no-repeat,linear-gradient(var(--sep),var(--sep))_bottom/100%_0.5px_no-repeat]",
          )}
          style={columns}
        >
          {data.map((p, i) => (
            <div
              key={p.title}
              title={`${p.title}: ${formatMoney(p.revenue, currency)}, ${p.transactions} sale${p.transactions === 1 ? "" : "s"}`}
              className={cx(
                p.revenue <= 0
                  ? "h-1 rounded-[4px] bg-[var(--fill)]"
                  : recent && i < n - 1
                    ? "rounded-[7px] bg-[color-mix(in_srgb,var(--tint)_30%,transparent)] lg:rounded-[10px_10px_4px_4px]"
                    : "rounded-[7px] bg-[var(--tint)] lg:rounded-[10px_10px_4px_4px]",
              )}
              style={p.revenue > 0 ? { height: `${Math.max(2, (p.revenue / max) * 100)}%` } : undefined}
            />
          ))}
        </div>
        {!recent && <span />}
        <div aria-hidden className={cx("grid text-center text-[12px] text-[var(--label2)]", gap, recent && "max-lg:hidden")} style={columns}>
          {data.map((p, i) => (
            <span
              key={p.title}
              className={cx("truncate", recent && i === n - 1 && "font-semibold text-[var(--tint)]")}
            >
              {i % every === 0 || i === n - 1 ? label(p, i) : ""}
            </span>
          ))}
        </div>
      </div>
      <figcaption className="sr-only">{caption}</figcaption>
      {!recent && <ValuesTable data={data} currency={currency} caption={caption} />}
    </figure>
  );
}

const METHOD_COLORS: Record<PaymentMethod, string> = {
  cash: "var(--green)",
  gcash: "var(--tint)",
  card: "var(--orange)",
  other: "var(--label2)",
};

/** Revenue by payment method as 12px bars (share of the total), amounts at the right, and the exact table. */
export function PaymentBars({ data, currency }: { data: MethodRow[]; currency: string }) {
  const grand = data.reduce((sum, d) => sum + d.total, 0);
  const share = (d: MethodRow) => (grand ? Math.round((d.total / grand) * 100) : 0);
  return (
    <figure className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.method} className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 text-[14px]">
          <span>{d.label}</span>
          <div className="h-3 rounded-[6px] bg-[var(--fill)]" title={`${d.label}: ${share(d)}% of revenue`}>
            {d.total > 0 && (
              <div
                className="h-full min-w-1.5 rounded-[6px]"
                style={{ width: `${share(d)}%`, background: METHOD_COLORS[d.method] }}
              />
            )}
          </div>
          <span className="min-w-[92px] text-right tabular-nums">{formatMoney(d.total, currency)}</span>
        </div>
      ))}
      <details className="text-[13px]">
        <summary className="cursor-pointer text-[var(--tint)] select-none">View as table</summary>
        <table className="listview mt-2">
          <thead>
            <tr>
              <th>Method</th>
              <th className="text-right">Sales</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.method}>
                <td>{d.label}</td>
                <td className="text-right tabular-nums">{d.count}</td>
                <td className="text-right tabular-nums">{formatMoney(d.total, currency)}</td>
                <td className="text-right tabular-nums">{share(d)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
