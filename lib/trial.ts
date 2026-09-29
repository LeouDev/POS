import type { Profile } from "@/lib/database.types";

/** Every new business gets this many days free (also the default in the free_trial migration). */
export const TRIAL_DAYS = 60;
const DAY = 86_400_000;

/** KASSIX Pro, paid per period through PayMongo. `days` must match record_payment() in the kassix_pro migration. */
export const PLANS = {
  monthly: { label: "Monthly", name: "KASSIX Pro (1 month)", amount: 149, days: 30, per: "month" },
  yearly: { label: "Yearly", name: "KASSIX Pro (1 year)", amount: 1490, days: 365, per: "year" },
} as const;
export type Plan = keyof typeof PLANS;
export const isPlan = (v: unknown): v is Plan => typeof v === "string" && Object.hasOwn(PLANS, v);

type PlanDates = Pick<Profile, "trial_ends_at" | "created_at"> & { paid_until?: string | null };

/** When the trial ends. Falls back to sign-up + 60 days on databases without the free_trial migration yet. */
export function trialEndsAt(profile: Pick<Profile, "trial_ends_at" | "created_at">): string {
  return profile.trial_ends_at ?? new Date(Date.parse(profile.created_at) + TRIAL_DAYS * DAY).toISOString();
}

/** Whether the business has paid for time beyond its trial. */
export const isPro = (profile: PlanDates) =>
  Boolean(profile.paid_until) && Date.parse(profile.paid_until!) > Date.parse(trialEndsAt(profile));

/** When access ends: the later of the trial end and the paid-up date (same rule as account_active() in SQL). */
export const accessEndsAt = (profile: PlanDates) => (isPro(profile) ? profile.paid_until! : trialEndsAt(profile));

export const hasAccess = (profile: PlanDates, now = Date.now()) => now < Date.parse(accessEndsAt(profile));

/** Whole days left, rounded up so the final day still reads "1 day left"; 0 once it has ended. */
export function trialDaysLeft(endsAt: string, now: number) {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / DAY));
}
