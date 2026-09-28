import { LogOut, Settings } from "lucide-react";
import type { Metadata } from "next";
import { signOut } from "@/app/login/actions";
import { Window } from "@/components/ui";
import { getProfile, getSession } from "@/lib/data";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const [profile, { email }] = await Promise.all([getProfile(), getSession()]);
  const timezones = Intl.supportedValuesOf("timeZone");
  if (!timezones.includes(profile.timezone)) timezones.unshift(profile.timezone);

  return (
    <Window title="Settings" icon={Settings} status={<span className="flex-1">Signed in as {email}</span>}>
      <div className="flex max-w-2xl flex-col gap-4">
        <SettingsForm profile={profile} timezones={timezones} />
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
