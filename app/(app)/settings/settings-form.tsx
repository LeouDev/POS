"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronsUpDown } from "lucide-react";
import { createPortal } from "react-dom";
import { useSyncExternalStore, type ReactNode } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";
import { useIos } from "@/components/theme";
import { cx, Field, fieldIds } from "@/components/ui";
import { useToast } from "@/components/toast";
import type { Profile } from "@/lib/database.types";
import { CURRENCIES, formatMoney, THEMES } from "@/lib/format";
import { settingsSchema, type SettingsInput } from "@/lib/schemas";
import { updateSettings } from "./actions";
import { safeCall } from "@/lib/actions";

// White/Black: Save sits at the page's top right, as in iOS. The page renders this slot in its toolbar
// and the form portals its buttons into it.
const SETTINGS_ACTIONS_ID = "settings-actions";
const noSubscribe = () => () => {};

export function SettingsActions() {
  return <div id={SETTINGS_ACTIONS_ID} className="contents" />;
}

export function SettingsForm({ profile, timezones }: { profile: Profile; timezones: string[] }) {
  const toast = useToast();
  const ios = useIos();
  const form = useForm<SettingsInput>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      businessName: profile.business_name,
      ownerName: profile.owner_name,
      currency: profile.currency as SettingsInput["currency"],
      taxRate: profile.tax_rate,
      timezone: profile.timezone,
      uiTheme: profile.ui_theme ?? "classic",
    },
  });
  const { handleSubmit, formState, reset } = form;
  const { isSubmitting, isDirty } = formState;
  const actionsSlot = useSyncExternalStore(
    noSubscribe,
    () => document.getElementById(SETTINGS_ACTIONS_ID),
    () => null,
  );

  const onSubmit = handleSubmit(async (values) => {
    const result = await safeCall(() => updateSettings(values));
    if (!result.ok) return toast(result.error, "error");
    reset(values);
    toast("Settings saved.");
  });

  const buttons = (
    <>
      {(!ios || isDirty) && (
        <button type="button" className="btn min-w-24" disabled={!isDirty || isSubmitting} onClick={() => reset()}>
          Revert
        </button>
      )}
      <button type="submit" form="settings-form" className="btn btn-default min-w-24" disabled={!isDirty || isSubmitting}>
        {isSubmitting ? "Saving…" : "Save"}
      </button>
    </>
  );

  return (
    <form id="settings-form" onSubmit={onSubmit} noValidate className={cx("flex flex-col", ios ? "gap-0" : "gap-4")}>
      {ios ? <IosFields form={form} timezones={timezones} /> : <ClassicFields form={form} timezones={timezones} />}
      {ios ? (
        actionsSlot && createPortal(buttons, actionsSlot)
      ) : (
        <div className="flex justify-end gap-2">{buttons}</div>
      )}
    </form>
  );
}

type FieldsProps = { form: UseFormReturn<SettingsInput>; timezones: string[] };

function ThemePicker({ form }: { form: UseFormReturn<SettingsInput> }) {
  const current = useWatch({ control: form.control, name: "uiTheme" });
  return (
    <div role="group" aria-label="Appearance" className="grid grid-cols-3 gap-2 ios:gap-3">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          aria-pressed={current === t.value}
          onClick={() => form.setValue("uiTheme", t.value, { shouldDirty: true })}
          className="btn !min-h-0 flex-col !gap-2 !px-2 !py-3 ios:!bg-transparent ios:!p-1 ios:!text-[var(--label)] ios:aria-pressed:!text-[var(--tint)]"
        >
          <span
            aria-hidden
            className="relative block h-14 w-full max-w-24 overflow-hidden border border-black ios:rounded-[12px] ios:border-[var(--sep)] ios:in-aria-pressed:shadow-[0_0_0_2px_var(--tint)]"
            style={{ background: t.color }}
          >
            <span
              className={cx("absolute inset-x-2.5 top-2.5 -bottom-1", t.value === "classic" ? "border border-white" : "rounded-t-[8px]")}
              style={{ background: t.card }}
            />
          </span>
          <span className="flex items-center gap-1.5 text-[13px] ios:text-[15px]">
            <span className="hidden size-[18px] flex-none place-items-center rounded-full border-[1.5px] border-[var(--label3)] ios:grid ios:in-aria-pressed:border-[var(--tint)] ios:in-aria-pressed:bg-[var(--tint)]">
              {current === t.value && <Check aria-hidden size={12} strokeWidth={3} className="text-white" />}
            </span>
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}

const THEME_NOTE = "Applies to this account on every device. Signing in and the KASSIX website keep the original look.";

function ClassicFields({ form, timezones }: FieldsProps) {
  const { register, formState, control } = form;
  const { errors } = formState;
  const currency = useWatch({ control, name: "currency" });
  return (
    <>
      <fieldset className="groupbox flex flex-col gap-2">
        <legend>Appearance</legend>
        <ThemePicker form={form} />
        <p className="text-[12px] text-neutral-600">{THEME_NOTE}</p>
      </fieldset>

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
    </>
  );
}

// iOS grouped inset lists: label on the left, the value (editable in place) on the right.
function Group({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-[22px]">
      {title && <h2 className="mx-5 mb-1.5 text-[13px] tracking-[0.03em] text-[var(--label2)] uppercase">{title}</h2>}
      <div className="card overflow-hidden rounded-[26px] pl-[18px]">{children}</div>
      {footer && <div className="mx-5 mt-1.5 text-[13px] leading-[1.35] text-[var(--label2)]">{footer}</div>}
    </section>
  );
}

function Row({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div className="border-b-[0.5px] border-[var(--sep)] py-1 pr-4 last:border-b-0">
      <div className="flex min-h-[42px] items-center gap-3">
        <label htmlFor={id} className="flex-none text-[17px]">
          {label}
        </label>
        {children}
      </div>
      {error && (
        <p id={`${id}-error`} className="pb-1.5 text-[13px] text-[var(--red)]">
          {error}
        </p>
      )}
    </div>
  );
}

const VALUE =
  "min-w-0 flex-1 bg-transparent text-right text-[17px] text-[var(--label2)] outline-none focus:text-[var(--label)] aria-[invalid=true]:text-[var(--red)]";

function IosSelect({ children, ...props }: React.ComponentProps<"select">) {
  return (
    <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
      <select {...props} className={cx(VALUE, "cursor-pointer appearance-none [text-align-last:right]")}>
        {children}
      </select>
      <ChevronsUpDown aria-hidden size={14} className="flex-none text-[var(--label3)]" />
    </span>
  );
}

function IosFields({ form, timezones }: FieldsProps) {
  const { register, formState, control } = form;
  const { errors } = formState;
  const currency = useWatch({ control, name: "currency" });
  return (
    <>
      <Group title="Appearance" footer={THEME_NOTE}>
        <div className="py-4 pr-[18px]">
          <ThemePicker form={form} />
        </div>
      </Group>
      <Group title="Business" footer="The business name is printed at the top of every receipt.">
        <Row id="s-business" label="Business name" error={errors.businessName?.message}>
          <input {...register("businessName")} {...fieldIds("s-business", errors.businessName?.message)} className={VALUE} />
        </Row>
        <Row id="s-owner" label="Owner name" error={errors.ownerName?.message}>
          <input
            {...register("ownerName")}
            {...fieldIds("s-owner", errors.ownerName?.message)}
            placeholder="Optional"
            className={cx(VALUE, "placeholder:text-[var(--label3)]")}
          />
        </Row>
      </Group>
      <Group
        title="Money & time"
        footer={`Example: ${formatMoney(1234.5, currency)}. Tax is added to every sale; use 0 for none. Timezone decides where 'today' starts and ends in reports.`}
      >
        <Row id="s-currency" label="Currency" error={errors.currency?.message}>
          <IosSelect {...register("currency")} {...fieldIds("s-currency", errors.currency?.message)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </IosSelect>
        </Row>
        <Row id="s-tax" label="Sales tax rate" error={errors.taxRate?.message}>
          <span className="flex min-w-0 flex-1 items-center justify-end">
            <input
              {...register("taxRate", { valueAsNumber: true })}
              {...fieldIds("s-tax", errors.taxRate?.message)}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              max="100"
              className={cx(VALUE, "w-20 flex-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none")}
            />
            <span className="text-[17px] text-[var(--label2)]">%</span>
          </span>
        </Row>
        <Row id="s-timezone" label="Timezone" error={errors.timezone?.message}>
          <IosSelect {...register("timezone")} {...fieldIds("s-timezone", errors.timezone?.message)}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </IosSelect>
        </Row>
      </Group>
    </>
  );
}
