"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Dialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { Field, fieldIds } from "@/components/ui";
import type { Category, ProductWithCategory } from "@/lib/database.types";
import { formatMoney } from "@/lib/format";
import { productSchema, type ProductInput } from "@/lib/schemas";
import { saveProduct } from "./actions";

export function ProductDialog({
  open,
  onClose,
  product,
  categories,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  product: ProductWithCategory | null;
  categories: Category[];
  currency: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} title={product ? `Edit ${product.name}` : "New product"} width={560}>
      <ProductForm product={product} categories={categories} currency={currency} onDone={onClose} />
    </Dialog>
  );
}

function ProductForm({
  product,
  categories,
  currency,
  onDone,
}: {
  product: ProductWithCategory | null;
  categories: Category[];
  currency: string;
  onDone: () => void;
}) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState, control, setError } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: product
      ? {
          name: product.name,
          sku: product.sku ?? "",
          categoryId: product.category_id ?? "",
          price: product.price,
          cost: product.cost,
          stockQuantity: product.stock_quantity,
          lowStockThreshold: product.low_stock_threshold,
          isActive: product.is_active,
        }
      : { name: "", sku: "", categoryId: "", stockQuantity: 0, lowStockThreshold: 5, isActive: true },
  });
  const { errors, isSubmitting } = formState;
  const [price, cost] = useWatch({ control, name: ["price", "cost"] });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await saveProduct(product?.id ?? null, values);
    if (!result.ok) {
      if (result.error.includes("SKU")) setError("sku", { message: result.error });
      else setFormError(result.error);
      return;
    }
    toast(product ? `Saved ${values.name}.` : `Added ${values.name}.`);
    onDone();
  });

  const margin = Number.isFinite(price) && Number.isFinite(cost) && price > 0 ? price - cost : null;

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-2">
      {formError && (
        <p role="alert" className="border border-brand bg-[#fff0f0] p-2 text-[13px] sm:col-span-2">
          {formError}
        </p>
      )}
      <Field id="p-name" label="Name" error={errors.name?.message} className="sm:col-span-2">
        <input {...register("name")} {...fieldIds("p-name", errors.name?.message)} className="field" autoComplete="off" />
      </Field>
      <Field id="p-sku" label="SKU / barcode (optional)" error={errors.sku?.message}>
        <input {...register("sku")} {...fieldIds("p-sku", errors.sku?.message)} className="field font-mono" autoComplete="off" />
      </Field>
      <Field id="p-category" label="Category" error={errors.categoryId?.message}>
        <select {...register("categoryId")} {...fieldIds("p-category", errors.categoryId?.message)} className="field">
          <option value="">No category</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field id="p-price" label={`Selling price (${currency})`} error={errors.price?.message}>
        <input
          {...register("price", { valueAsNumber: true })}
          {...fieldIds("p-price", errors.price?.message)}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className="field"
        />
      </Field>
      <Field
        id="p-cost"
        label={`Cost price (${currency})`}
        error={errors.cost?.message}
        hint={
          margin === null ? (
            "What you pay per unit. Use 0 if unknown."
          ) : margin < 0 ? (
            <span className="font-bold text-brand">Selling {formatMoney(-margin, currency)} below cost</span>
          ) : (
            `Margin ${formatMoney(margin, currency)} (${Math.round((margin / price) * 100)}%)`
          )
        }
      >
        <input
          {...register("cost", { valueAsNumber: true })}
          {...fieldIds("p-cost", errors.cost?.message)}
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          className="field"
        />
      </Field>
      <Field
        id="p-stock"
        label="Stock on hand"
        error={errors.stockQuantity?.message}
        hint={
          product ? (
            <>
              Change stock from <Link href="/inventory">Inventory</Link> so it&apos;s logged.
            </>
          ) : (
            "Logged as opening stock."
          )
        }
      >
        <input
          {...register("stockQuantity", { valueAsNumber: true })}
          {...fieldIds("p-stock", errors.stockQuantity?.message)}
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          readOnly={Boolean(product)}
          className="field"
        />
      </Field>
      <Field
        id="p-threshold"
        label="Low-stock alert at"
        error={errors.lowStockThreshold?.message}
        hint="Flag the product when stock falls to this."
      >
        <input
          {...register("lowStockThreshold", { valueAsNumber: true })}
          {...fieldIds("p-threshold", errors.lowStockThreshold?.message)}
          type="number"
          inputMode="numeric"
          step="1"
          min="0"
          className="field"
        />
      </Field>
      <label className="flex min-h-9 items-center gap-2 sm:col-span-2">
        <input {...register("isActive")} type="checkbox" className="check" />
        Available for sale (unticked products are archived and hidden from the register)
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" className="btn min-w-24" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-default min-w-24" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : product ? "Save" : "Add product"}
        </button>
      </div>
    </form>
  );
}
