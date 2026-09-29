"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Gift, KeyRound, MailCheck } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";
import { Field, fieldIds, TitleBar } from "@/components/ui";
import { resetRequestSchema, signInSchema, signUpSchema } from "@/lib/schemas";
import { PLANS, TRIAL_DAYS } from "@/lib/trial";
import { requestPasswordReset, signIn, signUp } from "./actions";
import { safeCall } from "@/lib/actions";

type Mode = "signin" | "signup" | "reset";

export function LoginWindow({
  next,
  linkError,
  startOnSignUp,
}: {
  next: string;
  linkError?: string;
  startOnSignUp?: boolean;
}) {
  const [mode, setMode] = useState<Mode>(startOnSignUp ? "signup" : "signin");
  const [sent, setSent] = useState<{ kind: "signup" | "reset"; email: string } | null>(null);

  return (
    <div className="window window-shadow w-full max-w-[460px]">
      <TitleBar title="Welcome to KASSIX" icon={KeyRound} />
      <div className="flex flex-col gap-3 p-3">
        <div className="sunken bg-[#e6e4e0] p-2">
          <Image
            src="/kassix-logo.webp"
            alt="KASSIX Point of Sale System"
            width={900}
            height={257}
            priority
            className="h-auto w-full"
          />
        </div>

        {sent ? (
          <div className="flex flex-col gap-3 py-2" role="status">
            <div className="flex gap-3">
              <MailCheck aria-hidden size={32} className="flex-none text-navy" />
              {sent.kind === "signup" ? (
                <p>
                  We sent a confirmation link to <b>{sent.email}</b>. Open it on this device to finish creating your
                  account. Your {TRIAL_DAYS}-day free trial starts when you first sign in.
                </p>
              ) : (
                <p>
                  If <b>{sent.email}</b> has a KASSIX account, we sent it a link to choose a new password. The link works
                  once; check your spam folder if it doesn&apos;t arrive in a few minutes.
                </p>
              )}
            </div>
            <button
              type="button"
              className="btn self-end"
              onClick={() => {
                setSent(null);
                setMode("signin");
              }}
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <div>
            <div className="flex gap-0.5 pl-1">
              <button type="button" className="tab" aria-pressed={mode !== "signup"} onClick={() => setMode("signin")}>
                Sign in
              </button>
              <button type="button" className="tab" aria-pressed={mode === "signup"} onClick={() => setMode("signup")}>
                Create account
              </button>
            </div>
            <div className="tabpanel">
              {mode === "signin" ? (
                <SignInForm
                  next={next}
                  linkError={linkError}
                  onNewAccount={() => setMode("signup")}
                  onForgot={() => setMode("reset")}
                />
              ) : mode === "reset" ? (
                <ResetRequestForm onSent={(email) => setSent({ kind: "reset", email })} onBack={() => setMode("signin")} />
              ) : (
                <SignUpForm onSent={(email) => setSent({ kind: "signup", email })} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 border border-brand bg-[#fff0f0] p-2 text-[13px]">
      <CircleAlert aria-hidden size={18} className="flex-none text-brand" />
      <span>{message}</span>
    </div>
  );
}

function SignInForm({
  next,
  linkError,
  onNewAccount,
  onForgot,
}: {
  next: string;
  linkError?: string;
  onNewAccount: () => void;
  onForgot: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await safeCall(() => signIn(values, next));
    if (result && !result.ok) setError(result.error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <FormError message={error ?? linkError} />
      <Field id="signin-email" label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          {...fieldIds("signin-email", errors.email?.message)}
          type="email"
          autoComplete="email"
          className="field"
        />
      </Field>
      <Field id="signin-password" label="Password" error={errors.password?.message}>
        <input
          {...register("password")}
          {...fieldIds("signin-password", errors.password?.message)}
          type="password"
          autoComplete="current-password"
          className="field"
        />
      </Field>
      <div className="flex items-center justify-between gap-2 pt-1">
        <button type="button" className="text-[13px] text-navy underline" onClick={onForgot}>
          Forgot password?
        </button>
        <button type="submit" className="btn btn-default btn-lg min-w-32" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </button>
      </div>
      <p className="border-t border-shade pt-3 text-[13px]">
        New to KASSIX?{" "}
        <button type="button" className="font-bold text-navy underline" onClick={onNewAccount}>
          Start your {TRIAL_DAYS}-day free trial
        </button>
      </p>
    </form>
  );
}

function ResetRequestForm({ onSent, onBack }: { onSent: (email: string) => void; onBack: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof resetRequestSchema>>({
    resolver: zodResolver(resetRequestSchema),
    defaultValues: { email: "" },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await safeCall(() => requestPasswordReset(values));
    if (!result.ok) setError(result.error);
    else onSent(values.email);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <p className="text-[13px]">Enter your account&apos;s email and we&apos;ll send you a link to choose a new password.</p>
      <FormError message={error} />
      <Field id="reset-email" label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          {...fieldIds("reset-email", errors.email?.message)}
          type="email"
          autoComplete="email"
          className="field"
        />
      </Field>
      <div className="flex items-center justify-between gap-2 pt-1">
        <button type="button" className="text-[13px] text-navy underline" onClick={onBack}>
          Back to sign in
        </button>
        <button type="submit" className="btn btn-default btn-lg min-w-32" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </button>
      </div>
    </form>
  );
}

function SignUpForm({ onSent }: { onSent: (email: string) => void }) {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      businessName: "",
      ownerName: "",
      email: "",
      password: "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
  const { errors, isSubmitting } = formState;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const result = await safeCall(() => signUp(values));
    if (!result) return; // signed straight in and redirected
    if (!result.ok) setError(result.error);
    else if (result.data.confirmEmail) onSent(values.email);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex items-start gap-2.5 border border-black bg-tip p-2.5 text-[13px]">
        <Gift aria-hidden size={22} className="flex-none text-brand" />
        <p>
          <b>{TRIAL_DAYS} days free.</b> Use every feature of KASSIX free for {TRIAL_DAYS} days to see if it fits your
          store. No credit card needed. After that, KASSIX Pro is ₱{PLANS.monthly.amount}/month.
        </p>
      </div>
      <FormError message={error} />
      <Field id="signup-business" label="Business name" error={errors.businessName?.message}>
        <input
          {...register("businessName")}
          {...fieldIds("signup-business", errors.businessName?.message)}
          autoComplete="organization"
          className="field"
        />
      </Field>
      <Field id="signup-owner" label="Your name (optional)" error={errors.ownerName?.message}>
        <input
          {...register("ownerName")}
          {...fieldIds("signup-owner", errors.ownerName?.message)}
          autoComplete="name"
          className="field"
        />
      </Field>
      <Field id="signup-email" label="Email" error={errors.email?.message}>
        <input
          {...register("email")}
          {...fieldIds("signup-email", errors.email?.message)}
          type="email"
          autoComplete="email"
          className="field"
        />
      </Field>
      <Field id="signup-password" label="Password" error={errors.password?.message} hint="At least 8 characters.">
        <input
          {...register("password")}
          {...fieldIds("signup-password", errors.password?.message)}
          type="password"
          autoComplete="new-password"
          className="field"
        />
      </Field>
      <div className="flex justify-end pt-1">
        <button type="submit" className="btn btn-default btn-lg min-w-32" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : `Start ${TRIAL_DAYS}-day free trial`}
        </button>
      </div>
      <p className="text-[12px]">
        By creating an account, you agree to the <Link href="/terms">Terms &amp; Conditions</Link> and{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>
    </form>
  );
}
