"use client";

import { Archive, ArchiveRestore, FolderTree, PackagePlus, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useState, useTransition, type FormEvent } from "react";
import { ConfirmDialog, Dialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { cx, StockBadge } from "@/components/ui";
import type { Category, ProductWithCategory } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { categoryNameSchema } from "@/lib/schemas";
import {
  addSampleProducts,
  createCategory,
  deleteCategory,
  deleteProduct,
  renameCategory,
  setProductActive,
} from "./actions";
import { ProductDialog } from "./product-dialog";
import { safeCall } from "@/lib/actions";

export function NewProductButton({ categories, currency }: { categories: Category[]; currency: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-default ios:!min-h-11 ios:!px-[18px]" onClick={() => setOpen(true)}>
        <PackagePlus aria-hidden size={16} /> New product
      </button>
      <ProductDialog open={open} onClose={() => setOpen(false)} product={null} categories={categories} currency={currency} />
    </>
  );
}

export function SampleProductsButton() {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="btn"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await safeCall(() => addSampleProducts());
          toast(result.ok ? "Added 9 sample products in 3 categories." : result.error, result.ok ? "success" : "error");
        })
      }
    >
      <Sparkles aria-hidden size={16} /> {pending ? "Adding…" : "Add sample products"}
    </button>
  );
}

// White/Black: row actions are small round buttons, as in the iOS mock-ups.
const ROUND = "ios:!min-h-[34px] ios:!min-w-[34px] ios:text-[var(--label2)]";

export function ProductsTable({
  products,
  categories,
  currency,
}: {
  products: ProductWithCategory[];
  categories: Category[];
  currency: string;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<ProductWithCategory | null>(null);
  const [deleting, setDeleting] = useState<ProductWithCategory | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function toggleActive(p: ProductWithCategory) {
    setBusyId(p.id);
    const result = await safeCall(() => setProductActive(p.id, !p.is_active));
    setBusyId(null);
    if (!result.ok) return toast(result.error, "error");
    toast(p.is_active ? `Archived ${p.name}. It's hidden from the register.` : `Restored ${p.name}.`);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    const result = await safeCall(() => deleteProduct(target.id));
    setDeleting(null); // close first: toasts sit under an open modal's backdrop
    if (!result.ok) return toast(result.error, "error");
    toast(
      result.data.archived
        ? `${target.name} has sales history, so it was archived instead of deleted.`
        : `Deleted ${target.name}.`,
      result.data.archived ? "info" : "success",
    );
  }

  return (
    <>
      <div className="sunken overflow-x-auto">
        <table className="listview">
          <thead>
            <tr>
              <th>Product</th>
              <th className="hidden md:table-cell">Category</th>
              <th className="text-right">Price</th>
              <th className="hidden text-right lg:table-cell">Cost</th>
              <th className="text-right">Stock</th>
              <th className="hidden sm:table-cell">Status</th>
              <th className="text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={cx(!p.is_active && "text-neutral-500")}>
                <td>
                  <div className="font-bold ios:font-semibold">{p.name}</div>
                  <div className="text-[12px] text-neutral-600">
                    {p.sku && <span className="font-mono">{p.sku}</span>}
                    <span className="md:hidden">
                      {p.sku && " · "}
                      {p.categories?.name ?? "No category"}
                    </span>
                  </div>
                </td>
                <td className="hidden md:table-cell">{p.categories?.name ?? <span className="text-neutral-500">None</span>}</td>
                <td className="text-right tabular-nums">{formatMoney(p.price, currency)}</td>
                <td className="hidden text-right tabular-nums lg:table-cell ios:text-[var(--label2)]">{formatMoney(p.cost, currency)}</td>
                <td className="text-right">
                  <div className="ios:flex ios:items-center ios:justify-end ios:gap-2">
                    <div className="font-bold tabular-nums">{p.stock_quantity}</div>
                    {p.is_active && <StockBadge product={p} />}
                  </div>
                </td>
                <td className="hidden sm:table-cell">{p.is_active ? "Active" : "Archived"}</td>
                <td>
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className={`btn btn-icon ${ROUND}`}
                      title="Edit"
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setEditing(p)}
                    >
                      <Pencil aria-hidden size={16} />
                    </button>
                    <button
                      type="button"
                      className={`btn btn-icon ${ROUND}`}
                      title={p.is_active ? "Archive" : "Restore"}
                      aria-label={`${p.is_active ? "Archive" : "Restore"} ${p.name}`}
                      disabled={busyId === p.id}
                      onClick={() => toggleActive(p)}
                    >
                      {p.is_active ? <Archive aria-hidden size={16} /> : <ArchiveRestore aria-hidden size={16} />}
                    </button>
                    <button
                      type="button"
                      className={`btn btn-icon btn-danger ${ROUND} ios:!text-[var(--red)]`}
                      title="Delete"
                      aria-label={`Delete ${p.name}`}
                      onClick={() => setDeleting(p)}
                    >
                      <Trash2 aria-hidden size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ProductDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        product={editing}
        categories={categories}
        currency={currency}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete product"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
      >
        <p>
          Delete <b>{deleting?.name}</b>? This can&apos;t be undone.
        </p>
        <p className="mt-2 text-[13px] text-neutral-700">
          If it has been sold before, it will be archived instead so your sales history stays intact.
        </p>
      </ConfirmDialog>
    </>
  );
}

export function CategoriesButton({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn" onClick={() => setOpen(true)}>
        <FolderTree aria-hidden size={16} className="text-[#806000] ios:text-current" /> Categories
        <span className="-ml-1.5 ios:hidden">…</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Categories" width={440}>
        <CategoryManager categories={categories} counts={counts} />
      </Dialog>
    </>
  );
}

function CategoryManager({ categories, counts }: { categories: Category[]; counts: Record<string, number> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  // Shown inline: this lives in a modal, where toasts would sit under the backdrop.
  const [listError, setListError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(e: FormEvent) {
    e.preventDefault();
    const parsed = categoryNameSchema.safeParse(name);
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    startTransition(async () => {
      const result = await safeCall(() => createCategory(parsed.data));
      if (!result.ok) return setError(result.error);
      setError(null);
      setName("");
    });
  }

  function saveRename() {
    if (!renaming) return;
    startTransition(async () => {
      const result = await safeCall(() => renameCategory(renaming.id, renaming.name));
      setListError(result.ok ? null : result.error);
      if (result.ok) setRenaming(null);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={add} noValidate className="flex flex-col gap-1">
        <label htmlFor="new-category" className="text-[13px]">
          New category
        </label>
        <div className="flex gap-2">
          <input
            id="new-category"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "new-category-error" : undefined}
            maxLength={50}
            autoComplete="off"
          />
          <button type="submit" className="btn btn-default" disabled={pending}>
            Add
          </button>
        </div>
        {error && (
          <p id="new-category-error" className="text-[12px] font-bold text-brand">
            {error}
          </p>
        )}
      </form>

      {listError && (
        <p role="alert" className="alert-box">
          {listError}
        </p>
      )}
      <div className="sunken max-h-72 overflow-y-auto">
        {categories.length === 0 ? (
          <p className="p-4 text-center text-[13px] text-neutral-600">No categories yet. Add one above.</p>
        ) : (
          <ul>
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 border-b border-face-light px-2 py-1.5 last:border-b-0">
                {renaming?.id === c.id ? (
                  <input
                    aria-label={`New name for ${c.name}`}
                    value={renaming.name}
                    onChange={(e) => setRenaming({ id: c.id, name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveRename();
                      if (e.key === "Escape") {
                        e.preventDefault(); // keep the dialog open
                        setRenaming(null);
                      }
                    }}
                    className="field"
                    maxLength={50}
                    autoFocus
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate">
                    {c.name} <span className="text-[12px] text-neutral-600">({counts[c.id] ?? 0})</span>
                  </span>
                )}
                {renaming?.id === c.id ? (
                  <>
                    <button type="button" className="btn btn-sm" disabled={pending} onClick={saveRename}>
                      Save
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setRenaming(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button type="button" className="btn btn-sm" onClick={() => setRenaming({ id: c.id, name: c.name })}>
                      Rename
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleting(c)}>
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete category"
        confirmLabel="Delete"
        onConfirm={async () => {
          if (!deleting) return;
          const result = await safeCall(() => deleteCategory(deleting.id));
          setListError(result.ok ? null : result.error);
          setDeleting(null);
        }}
      >
        <p>
          Delete <b>{deleting?.name}</b>?
        </p>
        {deleting && (counts[deleting.id] ?? 0) > 0 && (
          <p className="mt-2 text-[13px] text-neutral-700">
            Its {counts[deleting.id]} product(s) will stay, just without a category.
          </p>
        )}
      </ConfirmDialog>
    </div>
  );
}
