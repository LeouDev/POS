import { Package, PackageSearch, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterForm } from "@/components/filter-form";
import { EmptyState, Window } from "@/components/ui";
import { getCategories, getProducts, getProfile, param } from "@/lib/data";
import { ImportProductsButton } from "./import-dialog";
import { CategoriesButton, NewProductButton, ProductsTable, SampleProductsButton } from "./products-client";

export const metadata: Metadata = { title: "Products" };

const STATUSES = ["active", "archived", "all"] as const;

export default async function ProductsPage(props: PageProps<"/products">) {
  const sp = await props.searchParams;
  const q = param(sp.q).trim().slice(0, 50);
  const category = param(sp.category);
  const status = STATUSES.find((s) => s === param(sp.status)) ?? "active";
  const [products, categories, profile] = await Promise.all([getProducts(), getCategories(), getProfile()]);

  const needle = q.toLowerCase();
  const shown = products.filter(
    (p) =>
      (status === "all" || p.is_active === (status === "active")) &&
      (!category || (category === "none" ? !p.category_id : p.category_id === category)) &&
      (!needle || p.name.toLowerCase().includes(needle) || p.sku?.toLowerCase().includes(needle)),
  );
  const counts: Record<string, number> = {};
  for (const p of products) if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  const lowCount = products.filter((p) => p.is_active && p.is_low_stock).length;

  return (
    <Window
      title="Products"
      icon={Package}
      toolbar={
        <>
          <NewProductButton categories={categories} currency={profile.currency} />
          <CategoriesButton categories={categories} counts={counts} />
          <ImportProductsButton />
          <FilterForm key={JSON.stringify(sp)} action="/products" className="flex flex-1 flex-wrap items-center justify-end gap-1.5">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name or SKU"
              aria-label="Search products"
              className="field w-full sm:w-52"
            />
            <select name="category" defaultValue={category} aria-label="Category" className="field w-auto flex-1 sm:w-40 sm:flex-none">
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">No category</option>
            </select>
            <select name="status" defaultValue={status} aria-label="Status" className="field w-auto flex-1 sm:w-32 sm:flex-none">
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="all">All</option>
            </select>
            <button type="submit" className="btn btn-icon" aria-label="Search">
              <Search aria-hidden size={16} />
            </button>
          </FilterForm>
        </>
      }
      status={
        <>
          <span className="flex-1">
            {shown.length} of {products.length} product(s)
          </span>
          <span className={lowCount ? "text-brand" : undefined}>{lowCount} low on stock</span>
        </>
      }
    >
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          action={
            <>
              <NewProductButton categories={categories} currency={profile.currency} />
              <ImportProductsButton />
              <SampleProductsButton />
            </>
          }
        >
          Add what you sell, with its price, cost and stock, or import your list from a spreadsheet. Or load a few
          sample products to try the register.
        </EmptyState>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No products match these filters"
          action={
            <Link href="/products" className="btn">
              Clear filters
            </Link>
          }
        />
      ) : (
        <ProductsTable products={shown} categories={categories} currency={profile.currency} />
      )}
    </Window>
  );
}
