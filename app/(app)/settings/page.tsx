import { CalendarClock, ChevronRight, Crown, LogOut, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Window } from "@/components/window";
import { DaysLeft } from "@/components/trial";
import { getProfile, getSession } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { accessEndsAt, isPro, TRIAL_DAYS } from "@/lib/trial";
import { SettingsActions, SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [profile, { email }] = await Promise.all([getProfile(), getSession()]);
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(profile.timezone)) timezones.unshift(profile.timezone);
  const pro = isPro(profile);
  const endsAt = accessEndsAt(profile);

  if (profile.ui_theme === "light" || profile.ui_theme === "dark") {
    const Icon = pro ? Crown : CalendarClock;
    return (
      <Window title="Settings" toolbar={<SettingsActions />} status={<span className="flex-1">Signed in as {email}</span>}>
        <div className="flex w-full max-w-2xl flex-col">
          <Link href="/billing" className="card mb-[22px] flex items-center gap-3 rounded-[26px] px-4 py-3.5 !text-[var(--label)] no-underline">
            <span className="grid size-11 flex-none place-items-center rounded-[13px] bg-[var(--tint)] text-white">
              <Icon aria-hidden size={22} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[17px] font-semibold">{pro ? "KASSIX Pro" : "Free trial"}</span>
              <span className="text-[13px] text-[var(--label2)]">
                {pro ? "Paid until" : "Ends"} {formatDateTime(endsAt, profile.timezone, "date")} <DaysLeft endsAt={endsAt} />
              </span>
            </span>
            <span className="flex items-center gap-0.5 text-[15px] font-semibold text-[var(--tint)]">
              {pro ? "Add time" : "Get Pro"}
              <ChevronRight aria-hidden size={16} />
            </span>
          </Link>
          <SettingsForm profile={profile} timezones={timezones} />
          <form action={signOut}>
            <button type="submit" className="card h-[50px] w-full rounded-[26px] text-[17px] text-[var(--red)]">
              Log off
            </button>
          </form>
        </div>
      </Window>
    );
  }

  return (
    <Window title="Settings" icon={Settings} status={<span className="flex-1">Signed in as {email}</span>}>
      <div className="flex max-w-2xl flex-col gap-4">
        <SettingsForm profile={profile} timezones={timezones} />
        <fieldset className="groupbox flex items-start gap-3">
          <legend>Plan</legend>
          {pro ? (
            <Crown aria-hidden size={28} className="flex-none text-navy" />
          ) : (
            <CalendarClock aria-hidden size={28} className="flex-none text-navy" />
          )}
          <div className="flex flex-col items-start gap-2.5 text-[13px]">
            <p>
              {pro ? (
                <>
                  <b>KASSIX Pro.</b> Paid until
                </>
              ) : (
                <>
                  <b>{TRIAL_DAYS}-day free trial.</b> Every feature is free until
                </>
              )}{" "}
              <b>{formatDateTime(endsAt, profile.timezone, "date")}</b> <DaysLeft endsAt={endsAt} />.
            </p>
            <Link href="/billing" className="btn">
              <Crown aria-hidden size={16} /> {pro ? "Add KASSIX Pro time" : "Subscribe to KASSIX Pro"}
            </Link>
          </div>
        </fieldset>
        <fieldset className="groupbox flex flex-col gap-3">
          <legend>Account</legend>
          <p className="text-[13px]">
            Signed in as <b>{email}</b>. Everything you record in KASSIX is private to this account.
          </p>
          <form action={signOut}>
            <button type="submit" className="btn">
              <LogOut aria-hidden size={16} /> Log off
            </button>
          </form>
        </fieldset>
      </div>
    </Window>
  );
}
