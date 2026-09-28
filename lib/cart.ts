// Cart maths in integer cents, rounding tax half-up exactly like Postgres round(x, 2)
// does in complete_sale, so the total on screen is the total that gets recorded.

export type CartLine = { price: number; quantity: number };

export const toCents = (amount: number) => Math.round(amount * 100);

export function cartTotals(lines: CartLine[], discount: number, taxRate: number) {
  const subtotal = lines.reduce((sum, l) => sum + toCents(l.price) * l.quantity, 0);
  const off = toCents(discount);
  const taxable = subtotal - off;
  const tax = taxable > 0 ? Math.floor((taxable * toCents(taxRate) + 5000) / 10000) : 0;
  return {
    subtotal: subtotal / 100,
    discount: off / 100,
    tax: tax / 100,
    total: (taxable + tax) / 100,
  };
}

/** Round up to a "nice" note amount for quick cash buttons, e.g. 187.36 → 200, 500, 1000. */
export function quickCashAmounts(total: number) {
  const out = new Set<number>([total]);
  for (const step of [20, 50, 100, 500, 1000]) {
    const v = Math.ceil(total / step) * step;
    if (v > total) out.add(v);
    if (out.size >= 4) break;
  }
  return [...out].sort((a, b) => a - b);
}
