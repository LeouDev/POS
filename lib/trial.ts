import type { Profile } from "@/lib/database.types";

/** Every new business gets this many days free (also the default in the free_trial migration). */
export const TRIAL_DAYS = 60;
const DAY = 86_400_000;

/** When the trial ends. Falls back to sign-up + 60 days on databases without the free_trial migration yet. */
export function trialEndsAt(profile: Pick<Profile, "trial_ends_at" | "created_at">): string {
  return profile.trial_ends_at ?? new Date(Date.parse(profile.created_at) + TRIAL_DAYS * DAY).toISOString();
}

/** Whole days left, rounded up so the final day still reads "1 day left"; 0 once it has ended. */
export function trialDaysLeft(endsAt: string, now: number) {
  return Math.max(0, Math.ceil((Date.parse(endsAt) - now) / DAY));
}
