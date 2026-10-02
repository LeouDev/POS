"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Ban, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Dialog } from "@/components/dialog";
import { useToast } from "@/components/toast";
import { Field, fieldIds } from "@/components/ui";
import { safeCall } from "@/lib/actions";
import { voidSaleSchema, type VoidSaleInput } from "@/lib/schemas";
import { voidSale } from "./actions";

type Target = { id: string; receiptNumber: string; units: number };

export function VoidSaleButton({ sale }: { sale: Target }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn ios:!text-[var(--red)]" onClick={() => setOpen(true)}>
        <Ban aria-hidden size={16} className="text-brand" /> Void sale
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Void ${sale.receiptNumber}`} width={420}>
        <VoidForm sale={sale} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function VoidForm({ sale, onDone }: { sale: Target; onDone: () => void }) {
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<VoidSaleInput>({
    resolver: zodResolver(voidSaleSchema),
    defaultValues: { saleId: sale.id, reason: "" },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await safeCall(() => voidSale(values));
    if (!result.ok) return setFormError(result.error);
    toast(`${sale.receiptNumber} voided. Its items are back in stock.`);
    onDone();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex gap-3">
        <TriangleAlert aria-hidden size={32} className="flex-none fill-folder text-black" />
        <p className="pt-1">
          For a sale recorded by mistake. Its {sale.units} unit{sale.units === 1 ? "" : "s"} go back into stock and it
          stops counting in your sales and reports. The receipt stays in Sales, marked VOIDED. This can&apos;t be
          undone.
        </p>
      </div>
      {formError && (
        <p role="alert" className="alert-box">
          {formError}
        </p>
      )}
      <Field id="void-reason" label="Reason" error={errors.reason?.message} hint="Saved with the sale and in the stock history.">
        <input
          {...register("reason")}
          {...fieldIds("void-reason", errors.reason?.message)}
          placeholder="e.g. Rang up twice, customer cancelled"
          maxLength={150}
          className="field"
          data-autofocus
        />
      </Field>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn min-w-24" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-default btn-danger min-w-24" disabled={isSubmitting}>
          {isSubmitting ? "Voiding…" : "Void sale"}
        </button>
      </div>
    </form>
  );
}
