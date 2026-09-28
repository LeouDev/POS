"use client";

import {
  Banknote,
  CircleEllipsis,
  CreditCard,
  Minus,
  PackageSearch,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Smartphone,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent } from "react";
import { ConfirmDialog, Dialog } from "@/components/dialog";
import { Printable } from "@/components/printable";
import { Receipt } from "@/components/receipt";
import { useToast } from "@/components/toast";
import { cx, EmptyState } from "@/components/ui";
import { cartTotals, quickCashAmounts, toCents } from "@/lib/cart";
import type { Category, PaymentMethod, ProductWithCategory, SaleWithItems } from "@/lib/database.types";
import { formatMoney, PAYMENT_METHODS, stockStatus } from "@/lib/format";
import { checkout } from "./actions";

type Line = { productId: string; quantity: number };

const METHOD_ICONS = { cash: Banknote, card: CreditCard, gcash: Smartphone, other: CircleEllipsis };

// crypto.randomUUID only exists in secure contexts; tablets on http://<lan-ip> still need ids.
const newSaleId = () =>
  crypto.randomUUID?.() ??
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
  );

const twoDecimals = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

// A checkout that lost its connection is kept here until it's finished or cleared, so reloading
// the page and pressing Complete sale again reuses the same sale id and can't record it twice.
const PENDING_KEY = "kassix-pending-sale";
type Pending = { saleId: string; cart: Line[] };

function readPending(): Pending | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(PENDING_KEY) ?? "null");
    if (typeof p?.saleId !== "string" || !Array.isArray(p.cart)) return null;
    const cart = p.cart.filter(
      (l: Line) => typeof l?.productId === "string" && Number.isInteger(l.quantity) && l.quantity > 0,
    );
    return cart.length ? { saleId: p.saleId, cart } : null;
  } catch {
    return null;
  }
}

const pendingListeners = new Set<() => void>();
const subscribePending = (listener: () => void) => {
  pendingListeners.add(listener);
  return () => pendingListeners.delete(listener);
};
const pendingSnapshot = () => {
  try {
    return sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
};

function writePending(pending: Pending | null) {
  try {
    if (pending) sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
    else sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // storage unavailable (private mode): the in-memory id still covers retries without a reload
  }
  for (const listener of pendingListeners) listener();
}

export function Register({
  products,
  categories,
  hasUncategorized,
  currency,
  taxRate,
  businessName,
  timezone,
  nextReceipt,
}: {
  products: ProductWithCategory[];
  categories: Category[];
  hasUncategorized: boolean;
  currency: string;
  taxRate: number;
  businessName: string;
  timezone: string;
  nextReceipt: number;
}) {
  const toast = useToast();
  const money = (n: number) => formatMoney(n, currency);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState<Line[]>([]);
  const [discount, setDiscount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [tendered, setTendered] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState<{ sale: SaleWithItems; tendered: number | null } | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const busy = useRef(false);
  const saleId = useRef<string | null>(null);

  const interrupted = useSyncExternalStore(subscribePending, pendingSnapshot, () => null);

  function restoreInterrupted() {
    const pending = readPending();
    if (!pending) return writePending(null);
    saleId.current = pending.saleId;
    setCart(pending.cart);
  }

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const lines = cart.map((l) => ({ ...l, product: byId.get(l.productId) }));
  const blocked = lines.some((l) => !l.product || l.quantity > l.product.stock_quantity);
  const priced = lines.flatMap((l) => (l.product ? [{ price: l.product.price, quantity: l.quantity }] : []));
  const rawDiscount = discount.trim() === "" ? 0 : Number(discount);
  const discountError =
    !Number.isFinite(rawDiscount) || rawDiscount < 0
      ? "Enter an amount"
      : !twoDecimals(rawDiscount)
        ? "Use at most 2 decimals"
        : toCents(rawDiscount) > toCents(cartTotals(priced, 0, taxRate).subtotal)
          ? "Can't be more than the subtotal"
          : null;
  // An invalid discount is ignored in the totals shown (and blocks checkout) instead of going negative.
  const discountValue = discountError ? 0 : rawDiscount;
  const totals = cartTotals(priced, discountValue, taxRate);
  const tenderedValue = tendered.trim() === "" ? null : Number(tendered);
  const cashShort =
    method === "cash" &&
    tenderedValue !== null &&
    (!Number.isFinite(tenderedValue) || toCents(tenderedValue) < toCents(totals.total));
  const itemCount = cart.reduce((n, l) => n + l.quantity, 0);
  const canComplete = cart.length > 0 && !blocked && !discountError && !cashShort && !submitting;

  const needle = query.trim().toLowerCase();
  const visible = products.filter(
    (p) =>
      (category === "all" || (category === "none" ? !p.category_id : p.category_id === category)) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.sku?.toLowerCase().includes(needle)),
  );
  const qtyInCart = (id: string) => cart.find((l) => l.productId === id)?.quantity ?? 0;

  function add(p: ProductWithCategory) {
    const inCart = qtyInCart(p.id);
    if (p.stock_quantity <= 0) return toast(`${p.name} is out of stock.`, "error");
    if (inCart >= p.stock_quantity) return toast(`Only ${p.stock_quantity} ${p.name} in stock.`, "error");
    setCart((c) =>
      inCart
        ? c.map((l) => (l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l))
        : [...c, { productId: p.id, quantity: 1 }],
    );
  }

  function setQuantity(id: string, quantity: number) {
    const stock = byId.get(id)?.stock_quantity ?? 0;
    if (quantity > stock) toast(`Only ${stock} in stock.`, "error");
    const next = Math.max(1, Math.min(quantity, stock));
    setCart((c) => c.map((l) => (l.productId === id ? { ...l, quantity: next } : l)));
  }

  const remove = (id: string) => setCart((c) => c.filter((l) => l.productId !== id));

  function clearSale() {
    setCart([]);
    setDiscount("");
    setTendered("");
    setMethod("cash");
    setCartOpen(false);
    saleId.current = null;
    writePending(null);
  }

  function onSearchKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    // Barcode scanners type the SKU and press Enter.
    const hit =
      products.find((p) => p.sku && p.sku.toLowerCase() === needle) ?? (visible.length === 1 ? visible[0] : null);
    if (hit) {
      add(hit);
      setQuery("");
    }
  }

  async function completeSale() {
    if (busy.current || !canComplete) return;
    busy.current = true;
    setSubmitting(true);
    // Kept until the sale succeeds, so retrying after a dropped connection can't record it twice.
    saleId.current ??= newSaleId();
    try {
      const result = await checkout({
        saleId: saleId.current,
        items: cart,
        paymentMethod: method,
        discount: discountValue,
        expectedTotal: totals.total,
      });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      setCompleted({ sale: result.data, tendered: method === "cash" ? tenderedValue : null });
      clearSale();
    } catch (err) {
      unstable_rethrow(err); // e.g. signed out: that's a redirect to /login, not a failure
      writePending({ saleId: saleId.current, cart });
      toast(
        "Couldn't reach the server. Check your connection and press Complete sale again. It won't be recorded twice.",
        "error",
      );
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  }

  const change = completed?.tendered != null ? completed.tendered - completed.sale.total : null;

  return (
    <>
      {interrupted && cart.length === 0 && (
        <div role="alert" className="mb-2 flex flex-wrap items-center gap-2 border border-black bg-tip p-2 text-[13px]">
          <span className="min-w-0 flex-1">
            A sale was interrupted before it was confirmed. Restore it and press Complete sale: if it already went
            through you&apos;ll just get its receipt, it can&apos;t be recorded twice.
          </span>
          <button type="button" className="btn btn-sm btn-default" onClick={restoreInterrupted}>
            Restore sale
          </button>
          <button type="button" className="btn btn-sm" onClick={() => writePending(null)}>
            Discard
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(340px,1fr)]">
        {/* Products */}
        <section aria-label="Products" className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="relative">
            <Search
              aria-hidden
              size={18}
              className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-neutral-500"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              placeholder="Search products or scan SKU"
              aria-label="Search products or scan SKU"
              className="field !min-h-11 !pl-9"
              autoComplete="off"
            />
          </div>
          {(categories.length > 0 || hasUncategorized) && (
            <div role="group" aria-label="Categories" className="-mx-0.5 flex gap-1 overflow-x-auto px-0.5 pb-1">
              <CategoryChip label="All" active={category === "all"} onClick={() => setCategory("all")} />
              {categories.map((c) => (
                <CategoryChip key={c.id} label={c.name} active={category === c.id} onClick={() => setCategory(c.id)} />
              ))}
              {hasUncategorized && categories.length > 0 && (
                <CategoryChip label="Other" active={category === "none"} onClick={() => setCategory("none")} />
              )}
            </div>
          )}
          <div className="sunken min-h-0 flex-1 overflow-y-auto !bg-[#dcdcdc] p-2">
            {products.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="Nothing to sell yet"
                action={
                  <Link href="/products" className="btn btn-default">
                    Add products
                  </Link>
                }
              >
                Add products with stock and they&apos;ll appear here as buttons.
              </EmptyState>
            ) : visible.length === 0 ? (
              <EmptyState
                icon={PackageSearch}
                title="No products match"
                action={
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setQuery("");
                      setCategory("all");
                    }}
                  >
                    Show all products
                  </button>
                }
              />
            ) : (
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {visible.map((p) => (
                  <li key={p.id}>
                    <ProductTile product={p} inCart={qtyInCart(p.id)} price={money(p.price)} onAdd={() => add(p)} />
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="button"
            className="btn btn-lg justify-between lg:hidden"
            onClick={() => setCartOpen(true)}
            disabled={cart.length === 0}
            aria-label={`Review sale: ${itemCount} items, ${money(totals.total)}`}
          >
            <span className="flex items-center gap-2">
              <ShoppingCart aria-hidden size={18} /> {itemCount} item{itemCount === 1 ? "" : "s"}
            </span>
            <span>{money(totals.total)} ▸</span>
          </button>
        </section>

        {/* Current sale */}
        <section
          aria-label="Current sale"
          className={cx(
            "min-h-0 flex-col gap-2",
            cartOpen ? "window fixed inset-0 z-40 flex overflow-y-auto p-2" : "hidden lg:flex lg:overflow-y-auto",
          )}
        >
          {cartOpen && (
            <div className="titlebar lg:hidden">
              <span className="flex-1">Checkout</span>
              <button
                type="button"
                className="titlebar-button !h-7 !w-8"
                aria-label="Back to products"
                onClick={() => setCartOpen(false)}
              >
                <X aria-hidden size={16} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-bold">
              Current sale{" "}
              <span className="font-normal text-neutral-600">
                ({itemCount} item{itemCount === 1 ? "" : "s"})
              </span>
            </h2>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              disabled={cart.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 aria-hidden size={14} /> Clear
            </button>
          </div>

          <div className="sunken min-h-32 flex-1 overflow-y-auto lg:min-h-24">
            {lines.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-neutral-600">
                <ShoppingCart aria-hidden size={32} />
                <p>
                  <b className="text-black">Cart is empty.</b>
                  <br />
                  Tap a product to add it.
                </p>
              </div>
            ) : (
              <ul>
                {lines.map(({ productId, quantity, product }) => (
                  <li
                    key={productId}
                    className="flex flex-col gap-1.5 border-b border-face-light px-2 py-2 last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold">{product?.name ?? "Unavailable product"}</div>
                        {!product ? (
                          <div className="text-[12px] font-bold text-brand">
                            No longer available. Remove it to continue.
                          </div>
                        ) : quantity > product.stock_quantity ? (
                          <div className="text-[12px] font-bold text-brand">
                            Only {product.stock_quantity} left in stock.
                          </div>
                        ) : (
                          <div className="text-[12px] text-neutral-600">{money(product.price)} each</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn btn-icon btn-danger !min-h-8 !min-w-8"
                        aria-label={`Remove ${product?.name ?? "item"}`}
                        onClick={() => remove(productId)}
                      >
                        <X aria-hidden size={16} />
                      </button>
                    </div>
                    {product && (
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="btn btn-icon !min-h-9"
                            aria-label={`One less ${product.name}`}
                            disabled={quantity <= 1}
                            onClick={() => setQuantity(productId, quantity - 1)}
                          >
                            <Minus aria-hidden size={16} />
                          </button>
                          <QtyInput
                            key={quantity}
                            value={quantity}
                            max={product.stock_quantity}
                            label={`Quantity of ${product.name}`}
                            onCommit={(q) => setQuantity(productId, q)}
                          />
                          <button
                            type="button"
                            className="btn btn-icon !min-h-9"
                            aria-label={`One more ${product.name}`}
                            disabled={quantity >= product.stock_quantity}
                            onClick={() => setQuantity(productId, quantity + 1)}
                          >
                            <Plus aria-hidden size={16} />
                          </button>
                        </div>
                        <span className="font-bold tabular-nums">{money(product.price * quantity)}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="etched flex flex-col gap-1.5 p-2.5">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="tabular-nums">{money(totals.subtotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="pos-discount">Discount</label>
              <input
                id="pos-discount"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                aria-invalid={discountError ? true : undefined}
                aria-describedby={discountError ? "pos-discount-error" : undefined}
                className="field !min-h-9 w-32 text-right"
              />
            </div>
            {discountError && (
              <p id="pos-discount-error" className="text-right text-[12px] font-bold text-brand">
                {discountError}
              </p>
            )}
            <div className="flex justify-between">
              <span>Tax ({taxRate}%)</span>
              <span className="tabular-nums">{money(totals.tax)}</span>
            </div>
            <div className="lcd mt-1 flex items-baseline justify-between gap-2 px-2.5">
              <span className="text-[24px]">TOTAL</span>
              <span className="text-[40px] leading-none" aria-live="polite">
                {money(totals.total)}
              </span>
            </div>
          </div>

          <fieldset className="groupbox !p-2">
            <legend className="!font-normal">Payment method</legend>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
              {PAYMENT_METHODS.map((m) => {
                const Icon = METHOD_ICONS[m.value];
                return (
                  <button
                    key={m.value}
                    type="button"
                    className="btn"
                    aria-pressed={method === m.value}
                    onClick={() => setMethod(m.value)}
                  >
                    <Icon aria-hidden size={16} style={{ color: m.color === "#e8c547" ? "#806000" : m.color }} />{" "}
                    {m.label}
                  </button>
                );
              })}
            </div>
            {method === "cash" && cart.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="pos-tendered">Cash received</label>
                  <input
                    id="pos-tendered"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    placeholder="Optional"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    aria-invalid={cashShort ? true : undefined}
                    className="field !min-h-9 w-32 text-right"
                  />
                </div>
                <div className="flex flex-wrap justify-end gap-1">
                  {quickCashAmounts(totals.total).map((amount, i) => (
                    <button
                      key={amount}
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setTendered(String(amount))}
                    >
                      {i === 0 ? "Exact" : money(amount)}
                    </button>
                  ))}
                </div>
                {tenderedValue !== null && (
                  <div className={cx("text-right font-bold", cashShort ? "text-brand" : "text-ok")}>
                    {cashShort
                      ? `Short by ${money(Math.max(0, totals.total - (tenderedValue || 0)))}`
                      : `Change due: ${money(tenderedValue - totals.total)}`}
                  </div>
                )}
              </div>
            )}
          </fieldset>

          <button type="button" className="btn btn-xl btn-default" disabled={!canComplete} onClick={completeSale}>
            {submitting
              ? "Recording sale…"
              : cart.length === 0
                ? "Complete sale"
                : `Complete sale · ${money(totals.total)}`}
          </button>
          <div className="statusbar !hidden lg:!flex">
            <span className="flex-1">Next receipt R-{String(nextReceipt).padStart(6, "0")}</span>
            <span>Items: {itemCount}</span>
          </div>
        </section>

        <ConfirmDialog
          open={confirmClear}
          onClose={() => setConfirmClear(false)}
          title="Clear sale"
          confirmLabel="Clear"
          onConfirm={async () => {
            clearSale();
            setConfirmClear(false);
          }}
        >
          <p>Remove all {itemCount} item(s) from this sale?</p>
        </ConfirmDialog>

        <Dialog
          open={completed !== null}
          onClose={() => setCompleted(null)}
          title={`Sale complete - Receipt ${completed?.sale.receipt_number ?? ""}`}
          width={600}
        >
          {completed && (
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
              <div className="sunken flex max-h-[60dvh] justify-center overflow-auto !bg-[#7a7a7a] p-4">
                <Printable>
                  <Receipt
                    sale={completed.sale}
                    businessName={businessName}
                    currency={currency}
                    timezone={timezone}
                    tendered={completed.tendered}
                  />
                </Printable>
              </div>
              <div className="flex flex-col gap-2">
                <div className="lcd px-2.5 py-1.5" role="status">
                  <div className="text-[18px]">{change !== null ? "CHANGE DUE" : "PAID"}</div>
                  <div className="text-right text-[36px]">{money(change ?? completed.sale.total)}</div>
                </div>
                <button type="button" className="btn justify-start" onClick={() => window.print()}>
                  <Printer aria-hidden size={16} /> Print receipt
                </button>
                <Link href={`/sales/${completed.sale.id}`} className="btn justify-start">
                  View in Sales
                </Link>
                <div className="flex-1" />
                <button
                  type="button"
                  className="btn btn-xl btn-default"
                  data-autofocus
                  onClick={() => setCompleted(null)}
                >
                  New sale
                </button>
              </div>
            </div>
          )}
        </Dialog>
      </div>
    </>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className="btn flex-none" aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}

function ProductTile({
  product,
  inCart,
  price,
  onAdd,
}: {
  product: ProductWithCategory;
  inCart: number;
  price: string;
  onAdd: () => void;
}) {
  const status = stockStatus(product);
  const out = status === "out";
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-disabled={out || undefined}
      aria-label={`Add ${product.name}, ${price}, ${out ? "out of stock" : `${product.stock_quantity} in stock`}${inCart ? `, ${inCart} in cart` : ""}`}
      className={cx(
        "btn relative !flex h-full min-h-26 w-full !flex-col !items-stretch !justify-between gap-2 !p-2.5 text-left !whitespace-normal [border-width:2px] shadow-[inset_-2px_-2px_#808080,inset_2px_2px_#dfdfdf]",
        out && "!bg-[repeating-linear-gradient(45deg,#c0c0c0_0_6px,#b4b4b4_6px_12px)] text-neutral-500",
      )}
    >
      {inCart > 0 && (
        <span
          aria-hidden
          className="absolute -top-1 -right-1 grid min-w-6 place-items-center border border-black bg-navy px-1 text-[12px] font-bold text-white"
        >
          {inCart}
        </span>
      )}
      <span className="line-clamp-2 text-[14px] leading-tight font-bold">{product.name}</span>
      <span className="flex items-end justify-between gap-1 text-[12px]">
        <span className={cx("font-bold", out ? "text-maroon" : status === "low" ? "text-brand" : "text-neutral-600")}>
          {out
            ? "Out of stock"
            : status === "low"
              ? `Low: ${product.stock_quantity} left`
              : `${product.stock_quantity} in stock`}
        </span>
        <span className="text-[14px] font-bold text-black">{price}</span>
      </span>
    </button>
  );
}

function QtyInput({
  value,
  max,
  label,
  onCommit,
}: {
  value: number;
  max: number;
  label: string;
  onCommit: (quantity: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const commit = () => {
    const n = Math.floor(Number(draft));
    if (!Number.isFinite(n) || n < 1) return setDraft(String(value));
    setDraft(String(Math.min(n, max)));
    onCommit(n); // the register clamps to stock and says so
  };
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        }
      }}
      inputMode="numeric"
      aria-label={label}
      className="field !min-h-9 w-12 !px-1 text-center"
    />
  );
}
