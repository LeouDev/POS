import { Download, Package, PackageSearch, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FilterForm } from "@/components/filter-form";
import { cx, EmptyState, withParams } from "@/components/ui";
import { Window } from "@/components/window";
import { filterProducts, getCategories, getProducts, getProfile, productFilters } from "@/lib/data";
import { ImportProductsButton } from "./import-dialog";
import { CategoriesButton, NewProductButton, ProductsTable, SampleProductsButton } from "./products-client";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage(props: PageProps<"/products">) {
  const sp = await props.searchParams;
  const filters = productFilters(sp);
  const { q, category, status } = filters;
  const [products, categories, profile] = await Promise.all([getProducts(), getCategories(), getProfile()]);
  const shown = filterProducts(products, filters);
  const counts: Record<string, number> = {};
  for (const p of products) if (p.category_id) counts[p.category_id] = (counts[p.category_id] ?? 0) + 1;
  const lowCount = products.filter((p) => p.is_active && p.is_low_stock).length;
  const ios = profile.ui_theme === "light" || profile.ui_theme === "dark";
  const exportLink = shown.length > 0 && (
    // A plain link: the route builds the file with the same filters as this list.
    <a href={withParams("/products/export", filters, {})} download className="btn" title="These products as a CSV">
      <Download aria-hidden size={16} /> Export CSV
    </a>
  );

  return (
    <Window
      title="Products"
      icon={Package}
      toolbar={
        ios ? (
          <>
            <div className="glass glass-group">
              <CategoriesButton categories={categories} counts={counts} />
              <ImportProductsButton />
              {exportLink}
            </div>
            <NewProductButton categories={categories} currency={profile.currency} />
          </>
        ) : (
          <>
            <NewProductButton categories={categories} currency={profile.currency} />
            <CategoriesButton categories={categories} counts={counts} />
            <ImportProductsButton />
            {exportLink}
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
        )
      }
      filters={
        ios && products.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <FilterForm key={JSON.stringify(sp)} action="/products" className="flex w-full gap-2 sm:w-auto">
              <input
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search name or SKU"
                aria-label="Search products"
                className="field flex-1 sm:w-[300px] sm:flex-none"
              />
              {category && <input type="hidden" name="category" value={category} />}
              <select name="status" defaultValue={status} aria-label="Status" className="field !w-auto !rounded-full !bg-[var(--card)]">
                <option value="active">Active</option>
                <option value="archived">Archived</option>
                <option value="all">All</option>
              </select>
            </FilterForm>
            <nav aria-label="Categories" className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 py-0.5">
              {[
                { id: "", name: "All" },
                ...categories,
                ...(categories.length > 0 && products.some((p) => !p.category_id) ? [{ id: "none", name: "No category" }] : []),
              ].map((c) => (
                <Link
                  key={c.id}
                  href={withParams("/products", { q, status: status === "active" ? "" : status }, { category: c.id })}
                  aria-current={category === c.id ? "page" : undefined}
                  className={cx(
                    "flex h-[34px] flex-none items-center rounded-full px-3.5 text-[14px] whitespace-nowrap no-underline",
                    category === c.id
                      ? "bg-[var(--label)] font-semibold !text-[var(--bg)]"
                      : "bg-[var(--card)] !text-[var(--label)]",
                  )}
                >
                  {c.name}
                </Link>
              ))}
            </nav>
            <span className="ml-auto text-[13px] text-[var(--label2)]">
              {shown.length} of {products.length} products ·{" "}
              <span className={lowCount ? "text-[var(--red)]" : undefined}>{lowCount} low on stock</span>
            </span>
          </div>
        ) : undefined
      }
      status={
        ios ? undefined : (
          <>
            <span className="flex-1">
              {shown.length} of {products.length} product(s)
            </span>
            <span className={lowCount ? "text-brand" : undefined}>{lowCount} low on stock</span>
          </>
        )
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
