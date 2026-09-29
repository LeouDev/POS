"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { updatePassword } from "@/app/login/actions";
import { Field, fieldIds } from "@/components/ui";
import { safeCall } from "@/lib/actions";
import { newPasswordSchema } from "@/lib/schemas";

export function NewPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof newPasswordSchema>>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await safeCall(() => updatePassword(values));
    if (result && !result.ok) setError(result.error); // success redirects to the dashboard
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      {error && (
        <div role="alert" className="flex items-start gap-2 border border-brand bg-[#fff0f0] p-2 text-[13px]">
          <CircleAlert aria-hidden size={18} className="flex-none text-brand" />
          <span>{error}</span>
        </div>
      )}
      <Field id="new-password" label="New password" error={errors.password?.message} hint="At least 8 characters.">
        <input
          {...register("password")}
          {...fieldIds("new-password", errors.password?.message)}
          type="password"
          autoComplete="new-password"
          className="field"
        />
      </Field>
      <Field id="confirm-password" label="Type it again" error={errors.confirm?.message}>
        <input
          {...register("confirm")}
          {...fieldIds("confirm-password", errors.confirm?.message)}
          type="password"
          autoComplete="new-password"
          className="field"
        />
      </Field>
      <div className="flex justify-end pt-1">
        <button type="submit" className="btn btn-default btn-lg min-w-32" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save password"}
        </button>
      </div>
    </form>
  );
}
