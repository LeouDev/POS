import { Boxes, History, PackageSearch, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterForm } from "@/components/filter-form";
import { EmptyState, Pager, StockBadge, Window, withParams } from "@/components/ui";
import { describeError } from "@/lib/actions";
import { getProducts, getProfile, getSession, param } from "@/lib/data";
import type { MovementType } from "@/lib/database.types";
import { formatDateTime } from "@/lib/format";
import { AdjustStockButton } from "./adjust-stock";

export const metadata: Metadata = { title: "Inventory" };

const PAGE_SIZE = 25;
const MOVEMENT_TYPES: MovementType[] = ["SALE", "RESTOCK", "ADJUSTMENT"];
const TYPE_STYLES: Record<MovementType, string> = {
  SALE: "bg-navy text-white",
  RESTOCK: "bg-ok text-white",
  ADJUSTMENT: "bg-folder text-black",
};

export default async function InventoryPage(props: PageProps<"/inventory">) {
  const sp = await props.searchParams;
  const tab = param(sp.tab) === "log" ? "log" : "stock";

  return (
    <Window
      title="Inventory"
      icon={Boxes}
      toolbar={
        <nav aria-label="Inventory views" className="flex gap-0.5 self-end pl-1">
          <Link href="/inventory" className="tab" aria-current={tab === "stock" ? "page" : undefined}>
            <Boxes aria-hidden size={16} /> Stock levels
          </Link>
          <Link href="/inventory?tab=log" className="tab" aria-current={tab === "log" ? "page" : undefined}>
            <History aria-hidden size={16} /> Movement log
          </Link>
        </nav>
      }
    >
      {tab === "stock" ? <StockLevels sp={sp} /> : <MovementLog sp={sp} />}
    </Window>
  );
}

type SearchParams = Awaited<PageProps<"/inventory">["searchParams"]>;

async function StockLevels({ sp }: { sp: SearchParams }) {
  const q = param(sp.q).trim().slice(0, 50).toLowerCase();
  const level = param(sp.level);
  const products = (await getProducts()).filter((p) => p.is_active);
  const out = products.filter((p) => p.stock_quantity === 0).length;
  const low = products.filter((p) => p.is_low_stock && p.stock_quantity > 0).length;
  const shown = products.filter(
    (p) =>
      (level === "low" ? p.is_low_stock : level === "out" ? p.stock_quantity === 0 : true) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)),
  );

  if (products.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="Nothing to count yet"
        action={
          <Link href="/products" className="btn btn-default">
            Go to Products
          </Link>
        }
      >
        Stock levels appear here once you add products.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid flex-1 grid-cols-3 gap-2 sm:max-w-md">
          <Stat label="Products" value={products.length} />
          <Stat label="Low" value={low} tone={low ? "warn" : undefined} />
          <Stat label="Out" value={out} tone={out ? "bad" : undefined} />
        </div>
        <FilterForm key={JSON.stringify(sp)} action="/inventory" className="flex flex-1 flex-wrap justify-end gap-1.5">
          <input
            type="search"
            name="q"
            defaultValue={param(sp.q)}
            placeholder="Search name or SKU"
            aria-label="Search stock"
            className="field w-full sm:w-52"
          />
          <select name="level" defaultValue={level} aria-label="Stock level" className="field flex-1 sm:w-40 sm:flex-none">
            <option value="">All stock levels</option>
            <option value="low">Low or out</option>
            <option value="out">Out of stock</option>
          </select>
          <button type="submit" className="btn btn-icon" aria-label="Search">
            <Search aria-hidden size={16} />
          </button>
        </FilterForm>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title={level ? "Nothing is running low" : "No products match"}
          action={
            <Link href="/inventory" className="btn">
              Show all
            </Link>
          }
        />
      ) : (
        <div className="sunken overflow-x-auto">
          <table className="listview">
            <thead>
              <tr>
                <th>Product</th>
                <th className="text-right">On hand</th>
                <th className="hidden text-right sm:table-cell">Alert at</th>
                <th className="hidden md:table-cell">Status</th>
                <th className="text-right">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-[12px] text-neutral-600">
                      {[p.sku, p.categories?.name].filter(Boolean).join(" · ") || "No category"}
                    </div>
                    <div className="md:hidden">
                      <StockBadge product={p} />
                    </div>
                  </td>
                  <td className="text-right text-[16px] font-bold tabular-nums">{p.stock_quantity}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{p.low_stock_threshold}</td>
                  <td className="hidden md:table-cell">
                    <StockBadge product={p} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1">
                      <AdjustStockButton product={p} />
                      <Link
                        href={`/inventory?tab=log&product=${p.id}`}
                        className="btn btn-sm"
                        aria-label={`Stock history for ${p.name}`}
                        title="History"
                      >
                        <History aria-hidden size={16} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[12px] text-neutral-600">Archived products are hidden here. Restore them from Products.</p>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" | "bad" }) {
  return (
    <div className="sunken px-2 py-1">
      <div className="text-[12px] text-neutral-600">{label}</div>
      <div className={`text-[20px] font-bold tabular-nums ${tone === "bad" ? "text-maroon" : tone === "warn" ? "text-brand" : ""}`}>
        {value}
      </div>
    </div>
  );
}

async function MovementLog({ sp }: { sp: SearchParams }) {
  const productId = param(sp.product);
  const type = MOVEMENT_TYPES.find((t) => t === param(sp.type));
  const page = Math.max(1, Math.floor(Number(param(sp.page))) || 1);
  const [{ supabase }, profile, products] = await Promise.all([getSession(), getProfile(), getProducts()]);

  let query = supabase
    .from("inventory_movements")
    .select("id, type, quantity, notes, reference_id, created_at, products(name, sku)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (products.some((p) => p.id === productId)) query = query.eq("product_id", productId);
  if (type) query = query.eq("type", type);
  const { data: moves, count, error } = await query;
  if (error) throw new Error(describeError(error));

  const current = { tab: "log", product: productId, type: type ?? "" };
  const pages = Math.ceil((count ?? 0) / PAGE_SIZE);

  return (
    <div className="flex flex-col gap-3">
      <FilterForm key={JSON.stringify(sp)} action="/inventory" className="flex flex-wrap justify-end gap-1.5">
        <input type="hidden" name="tab" value="log" />
        <select name="product" defaultValue={productId} aria-label="Product" className="field flex-1 sm:w-56 sm:flex-none">
          <option value="">All products</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.is_active ? "" : " (archived)"}
            </option>
          ))}
        </select>
        <select name="type" defaultValue={type ?? ""} aria-label="Movement type" className="field flex-1 sm:w-40 sm:flex-none">
          <option value="">All changes</option>
          <option value="SALE">Sales</option>
          <option value="RESTOCK">Restocks</option>
          <option value="ADJUSTMENT">Adjustments</option>
        </select>
      </FilterForm>

      {!moves?.length ? (
        <EmptyState icon={History} title="No stock changes recorded">
          Sales, restocks and stock counts show up here as they happen.
        </EmptyState>
      ) : (
        <div className="sunken overflow-x-auto">
          <table className="listview">
            <thead>
              <tr>
                <th>When</th>
                <th>Product</th>
                <th>Change</th>
                <th className="hidden sm:table-cell">Note</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="text-[12px] whitespace-nowrap">{formatDateTime(m.created_at, profile.timezone)}</td>
                  <td>
                    <div className="font-bold">{m.products?.name ?? "Deleted product"}</div>
                    <div className="text-[12px] text-neutral-600 sm:hidden">{m.notes}</div>
                  </td>
                  <td className="whitespace-nowrap">
                    <span className={`mr-2 inline-block border border-black px-1 text-[11px] font-bold ${TYPE_STYLES[m.type]}`}>
                      {m.type}
                    </span>
                    <b className="tabular-nums">{m.quantity > 0 ? `+${m.quantity}` : m.quantity}</b>
                  </td>
                  <td className="hidden sm:table-cell">
                    {m.type === "SALE" && m.reference_id ? <Link href={`/sales/${m.reference_id}`}>{m.notes}</Link> : m.notes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={page} pages={pages} href={(n) => withParams("/inventory", current, { page: n })} />
    </div>
  );
}
