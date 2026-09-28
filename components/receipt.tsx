import type { ReactNode } from "react";
import type { SaleWithItems } from "@/lib/database.types";
import { formatDateTime, formatMoney, paymentLabel } from "@/lib/format";

function Row({ left, right, bold }: { left: ReactNode; right: ReactNode; bold?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${bold ? "text-[15px] font-bold" : ""}`}>
      <span className="min-w-0">{left}</span>
      <span className="whitespace-nowrap">{right}</span>
    </div>
  );
}

const Rule = () => <div className="my-2.5 border-t border-dashed border-black" />;

/** Till-roll receipt. Prints on its own via the .print-area rules in globals.css. */
export function Receipt({
  sale,
  businessName,
  currency,
  timezone,
  tendered,
}: {
  sale: SaleWithItems;
  businessName: string;
  currency: string;
  timezone: string;
  tendered?: number | null;
}) {
  const money = (n: number) => formatMoney(n, currency);
  return (
    <div className="receipt-paper print-area w-[300px] max-w-full flex-none text-black">
      <div className="text-center text-[15px] font-bold break-words uppercase">{businessName}</div>
      <div className="text-center">Sales receipt</div>
      <Rule />
      <Row left={formatDateTime(sale.created_at, timezone, "date")} right={formatDateTime(sale.created_at, timezone, "time")} />
      <Row left={`No. ${sale.receipt_number}`} right={paymentLabel(sale.payment_method)} />
      <Rule />
      {sale.sale_items.map((item) => (
        <div key={item.id}>
          <div className="break-words">{item.product_name}</div>
          <Row left={`  ${item.quantity} x ${money(item.unit_price)}`} right={money(item.subtotal)} />
        </div>
      ))}
      <Rule />
      <Row left="SUBTOTAL" right={money(sale.subtotal)} />
      {sale.discount > 0 && <Row left="DISCOUNT" right={`-${money(sale.discount)}`} />}
      {sale.tax > 0 && <Row left="TAX" right={money(sale.tax)} />}
      <Row left="TOTAL" right={money(sale.total)} bold />
      {tendered != null && (
        <>
          <Row left="CASH" right={money(tendered)} />
          <Row left="CHANGE" right={money(tendered - sale.total)} />
        </>
      )}
      <Rule />
      {sale.status === "voided" && <div className="text-center font-bold">*** VOIDED ***</div>}
      <div className="text-center">THANK YOU!</div>
      <div aria-hidden className="mt-2 overflow-hidden text-center font-lcd text-[22px] tracking-[0.12em] whitespace-nowrap">
        ||| || ||||| | || ||| |
      </div>
    </div>
  );
}
