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

type MethodRow = { label: string; total: number; count: number };

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
