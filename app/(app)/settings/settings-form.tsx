"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { Field, fieldIds } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Profile } from "@/lib/database.types";
import { CURRENCIES, formatMoney } from "@/lib/format";
import { settingsSchema, type SettingsInput } from "@/lib/schemas";
import { updateSettings } from "./actions";

export function SettingsForm({ profile, timezones }: { profile: Profile; timezones: string[] }) {
  const toast = useToast();
  const { register, handleSubmit, formState, control, reset } = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: profile.business_name,
      ownerName: profile.owner_name,
      currency: profile.currency as SettingsInput["currency"],
      taxRate: profile.tax_rate,
      timezone: profile.timezone,
    },
  });
  const { errors, isSubmitting, isDirty } = formState;
  const currency = useWatch({ control, name: "currency" });

  const onSubmit = handleSubmit(async (values) => {
    const result = await updateSettings(values);
    if (!result.ok) return toast(result.error, "error");
    reset(values);
    toast("Settings saved.");
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <fieldset className="groupbox grid gap-3 sm:grid-cols-2">
        <legend>Business</legend>
        <Field id="s-business" label="Business name" error={errors.businessName?.message} className="sm:col-span-2">
          <input {...register("businessName")} {...fieldIds("s-business", errors.businessName?.message)} className="field" />
        </Field>
        <Field id="s-owner" label="Owner name" error={errors.ownerName?.message} className="sm:col-span-2">
          <input {...register("ownerName")} {...fieldIds("s-owner", errors.ownerName?.message)} className="field" />
        </Field>
        <p className="text-[12px] text-neutral-600 sm:col-span-2">The business name is printed at the top of every receipt.</p>
      </fieldset>

      <fieldset className="groupbox grid gap-3 sm:grid-cols-2">
        <legend>Money &amp; time</legend>
        <Field id="s-currency" label="Currency" error={errors.currency?.message} hint={`Example: ${formatMoney(1234.5, currency)}`}>
          <select {...register("currency")} {...fieldIds("s-currency", errors.currency?.message)} className="field">
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field id="s-tax" label="Sales tax rate (%)" error={errors.taxRate?.message} hint="Added to every sale. Use 0 for none.">
          <input
            {...register("taxRate", { valueAsNumber: true })}
            {...fieldIds("s-tax", errors.taxRate?.message)}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            max="100"
            className="field"
          />
        </Field>
        <Field
          id="s-timezone"
          label="Timezone"
          error={errors.timezone?.message}
          hint="Decides where 'today' starts and ends in reports."
          className="sm:col-span-2"
        >
          <select {...register("timezone")} {...fieldIds("s-timezone", errors.timezone?.message)} className="field">
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </Field>
      </fieldset>

      <div className="flex justify-end gap-2">
        <button type="button" className="btn min-w-24" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
          Revert
        </button>
        <button type="submit" className="btn btn-default min-w-24" disabled={!isDirty || isSubmitting}>
          {isSubmitting ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
