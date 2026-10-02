"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PackagePlus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Dialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { cx, Field, fieldIds } from "@/components/ui";
import type { Product } from "@/lib/database.types";
import { adjustStockSchema, type AdjustStockInput } from "@/lib/schemas";
import { adjustStock } from "./actions";
import { safeCall } from "@/lib/actions";

type Target = Pick<Product, "id" | "name" | "stock_quantity">;

export function AdjustStockButton({ product }: { product: Target }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={cx(
          "btn btn-sm",
          product.stock_quantity === 0 ? "ios:!bg-[var(--tint)] ios:!text-white" : "ios:!text-[var(--tint)]",
        )}
        onClick={() => setOpen(true)}
        aria-label={`Restock or adjust ${product.name}`}
      >
        <PackagePlus aria-hidden size={16} className="ios:hidden" />{" "}
        <span className="hidden sm:inline ios:inline">Restock / adjust</span>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Stock: ${product.name}`} width={420}>
        <AdjustForm product={product} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function AdjustForm({ product, onDone }: { product: Target; onDone: () => void }) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState, control, setValue } = useForm<AdjustStockInput>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: { productId: product.id, type: "RESTOCK", notes: "" },
  });
  const { errors, isSubmitting } = formState;
  const [type, quantity] = useWatch({ control, name: ["type", "quantity"] });
  const restock = type === "RESTOCK";
  const next = Number.isInteger(quantity) ? (restock ? product.stock_quantity + quantity : quantity) : null;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await safeCall(() => adjustStock(values));
    if (!result.ok) return setFormError(result.error);
    toast(`${product.name}: stock is now ${result.data.stock}.`);
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span>On hand now</span>
        <span className="lcd text-[30px]">{product.stock_quantity}</span>
      </div>
      <div className="segmented grid grid-cols-2 gap-1" role="group" aria-label="Kind of change">
        <button type="button" className="btn" aria-pressed={restock} onClick={() => setValue("type", "RESTOCK")}>
          <PackagePlus aria-hidden size={16} /> Restock
        </button>
        <button type="button" className="btn" aria-pressed={!restock} onClick={() => setValue("type", "ADJUSTMENT")}>
          <SlidersHorizontal aria-hidden size={16} /> Set count
        </button>
      </div>
      {formError && (
        <p role="alert" className="alert-box">
          {formError}
        </p>
      )}
      <Field
        id="adj-qty"
        label={restock ? "Units received" : "Counted stock on the shelf"}
        error={errors.quantity?.message}
        hint={
          next !== null && next >= 0
            ? `New stock: ${next} (${next - product.stock_quantity >= 0 ? "+" : ""}${next - product.stock_quantity})`
            : restock
              ? "Adds to the current stock."
              : "Replaces the current stock, e.g. after a count or breakage."
        }
      >
        <input
          {...register("quantity", { valueAsNumber: true })}
          {...fieldIds("adj-qty", errors.quantity?.message)}
          type="number"
          inputMode="numeric"
          min="0"
          step="1"
          className="field"
          data-autofocus
        />
      </Field>
      <Field id="adj-notes" label="Note (optional)" error={errors.notes?.message}>
        <input
          {...register("notes")}
          {...fieldIds("adj-notes", errors.notes?.message)}
          placeholder={restock ? "e.g. Supplier delivery" : "e.g. Shelf count, 2 damaged"}
          maxLength={200}
          className="field"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn min-w-24" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-default min-w-24" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
