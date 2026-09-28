import { ArrowLeft, ReceiptText, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Printable } from "@/components/printable";
import { Receipt } from "@/components/receipt";
import { Window } from "@/components/ui";
import { describeError } from "@/lib/actions";
import { getProfile, getSession } from "@/lib/data";
import { formatDateTime, formatMoney, paymentLabel } from "@/lib/format";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPage(props: PageProps<"/sales/[id]">) {
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const [{ supabase }, profile] = await Promise.all([getSession(), getProfile()]);
  const { data: sale, error } = await supabase
    .from("sales")
    .select("*, sale_items(*)")
    .eq("id", id)
    .order("product_name", { referencedTable: "sale_items" })
    .maybeSingle();
  if (error) throw new Error(describeError(error));
  if (!sale) notFound();

  const money = (n: number) => formatMoney(n, profile.currency);
  const cost = sale.sale_items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0);
  const units = sale.sale_items.reduce((sum, i) => sum + i.quantity, 0);
  const profit = sale.subtotal - sale.discount - cost;

  return (
    <Window
      title={`Receipt ${sale.receipt_number}`}
      icon={ReceiptText}
      toolbar={
        <>
          <Link href="/sales" className="btn">
            <ArrowLeft aria-hidden size={16} /> All sales
          </Link>
          <PrintButton />
          <div className="flex-1" />
          <Link href="/sale" className="btn">
            <ShoppingCart aria-hidden size={16} className="text-ok" /> New sale
          </Link>
        </>
      }
      status={
        <>
          <span className="flex-1">Recorded {formatDateTime(sale.created_at, profile.timezone)}</span>
          <span className="capitalize">{sale.status}</span>
        </>
      }
    >
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="sunken flex justify-center !bg-[#7a7a7a] px-2 py-5">
          <Printable>
            <Receipt sale={sale} businessName={profile.business_name} currency={profile.currency} timezone={profile.timezone} />
          </Printable>
        </div>
        <div className="flex flex-col gap-3">
          <fieldset className="groupbox">
            <legend>Details</legend>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="text-neutral-600">Receipt</dt>
              <dd className="font-mono font-bold">{sale.receipt_number}</dd>
              <dt className="text-neutral-600">Date</dt>
              <dd>{formatDateTime(sale.created_at, profile.timezone)}</dd>
              <dt className="text-neutral-600">Payment</dt>
              <dd>{paymentLabel(sale.payment_method)}</dd>
              <dt className="text-neutral-600">Status</dt>
              <dd className="capitalize">{sale.status}</dd>
              <dt className="text-neutral-600">Units</dt>
              <dd>
                {units} across {sale.sale_items.length} product{sale.sale_items.length === 1 ? "" : "s"}
              </dd>
            </dl>
          </fieldset>
          <fieldset className="groupbox">
            <legend>Totals</legend>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px] tabular-nums">
              <dt>Subtotal</dt>
              <dd className="text-right">{money(sale.subtotal)}</dd>
              <dt>Discount</dt>
              <dd className="text-right">-{money(sale.discount)}</dd>
              <dt>Tax</dt>
              <dd className="text-right">{money(sale.tax)}</dd>
              <dt className="font-bold">Total paid</dt>
              <dd className="text-right font-bold">{money(sale.total)}</dd>
              <dt className="border-t border-shade pt-1.5 text-neutral-600">Est. cost</dt>
              <dd className="border-t border-shade pt-1.5 text-right text-neutral-600">{money(cost)}</dd>
              <dt className="text-neutral-600">Est. profit</dt>
              <dd className={`text-right font-bold ${profit < 0 ? "text-brand" : "text-ok"}`}>{money(profit)}</dd>
            </dl>
          </fieldset>
          <p className="text-[12px] text-neutral-600">
            Names, prices and costs are stored as they were at the time of sale, so later product edits don&apos;t
            change this receipt.
          </p>
        </div>
      </div>
    </Window>
  );
}
