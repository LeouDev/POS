import { Database, LogOut } from "lucide-react";
import type { Viewport } from "next";
import { redirect, unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { Shell } from "@/components/shell";
import { TitleBar } from "@/components/ui";
import { MISSING_TABLES } from "@/lib/actions";
import { getProfile, getSession } from "@/lib/data";
import { THEMES } from "@/lib/format";
import { accessEndsAt, hasAccess, isPro } from "@/lib/trial";

// The browser and home-screen app bar match the owner's appearance.
export async function generateViewport(): Promise<Viewport> {
  const profile = await getProfile().catch((err: unknown) => {
    unstable_rethrow(err);
    return null;
  });
  return { themeColor: THEMES.find((t) => t.value === profile?.ui_theme)?.color ?? THEMES[0].color };
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  // Production hides server error messages, so the likeliest setup mistake (migration not run)
  // is rendered as a normal page instead of being thrown.
  const loaded = await Promise.all([getSession(), getProfile()]).catch((err: unknown) => {
    unstable_rethrow(err);
    if (err instanceof Error && err.message === MISSING_TABLES) return null;
    throw err;
  });
  if (!loaded) return <SetupNeeded />;
  const [{ email }, profile] = loaded;
  // Trial or paid time is over: only the KASSIX Pro page is open (RLS enforces the same in the database).
  if (!hasAccess(profile)) redirect("/billing");

  return (
    <Shell
      theme={profile.ui_theme ?? "classic"}
      businessName={profile.business_name}
      email={email}
      timezone={profile.timezone}
      accessEndsAt={accessEndsAt(profile)}
      pro={isPro(profile)}
    >
      {children}
    </Shell>
  );
}

function SetupNeeded() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-3">
      <section className="window window-shadow w-full max-w-lg">
        <TitleBar title="KASSIX setup" icon={Database} />
        <div className="flex flex-col gap-3 p-4">
          <p className="font-bold">The database isn&apos;t set up yet.</p>
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px]">
            <li>Open your Supabase project&apos;s SQL editor.</li>
            <li>
              Run each file in <code className="font-mono">supabase/migrations/</code>, in order (or run{" "}
              <code className="font-mono">npx supabase db push</code>).
            </li>
            <li>Reload this page.</li>
          </ol>
          <div className="flex justify-end">
            <form action={signOut}>
              <button type="submit" className="btn">
                <LogOut aria-hidden size={16} /> Log off
              </button>
            </form>
          </div>
        </div>
      </section>
    </main>
  );
}
