import { CalendarClock, Crown, LogOut, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/login/actions";
import { Window } from "@/components/ui";
import { DaysLeft } from "@/components/trial";
import { getProfile, getSession } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { accessEndsAt, isPro, TRIAL_DAYS } from "@/lib/trial";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [profile, { email }] = await Promise.all([getProfile(), getSession()]);
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(profile.timezone)) timezones.unshift(profile.timezone);
  const pro = isPro(profile);
  const endsAt = accessEndsAt(profile);

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
