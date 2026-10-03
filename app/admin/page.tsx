import { LayoutDashboard, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cx, Lcd, TitleBar } from "@/components/ui";
import { describeError } from "@/lib/actions";
import type { AdminAccount } from "@/lib/database.types";
import { getProfile, getSession } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { accessEndsAt, isPro, PLANS, trialDaysLeft } from "@/lib/trial";

export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false } };

const days = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

/** Where an account stands: trial or KASSIX Pro (with the latest plan bought), days left, or ended. */
function planOf(a: AdminAccount, now: number) {
  if (!a.trial_ends_at || !a.profile_created_at) return null; // hasn't opened KASSIX yet
  const dates = { trial_ends_at: a.trial_ends_at, created_at: a.profile_created_at, paid_until: a.paid_until };
  const pro = isPro(dates);
  const endsAt = accessEndsAt(dates);
  return {
    pro,
    endsAt,
    left: trialDaysLeft(endsAt, now),
    name: pro ? `KASSIX Pro${a.last_plan ? ` (${PLANS[a.last_plan].label})` : ""}` : "Free trial",
  };
}

/** Each account with its plan worked out, and the headline counts. */
function overview(accounts: AdminAccount[], now = Date.now()) {
  const rows = accounts.map((a) => ({ ...a, plan: planOf(a, now) }));
  const count = (keep: (r: (typeof rows)[number]) => boolean) => rows.filter(keep).length;
  return {
    rows,
    setUp: count((r) => Boolean(r.plan)),
    trial: count((r) => Boolean(r.plan && !r.plan.pro && r.plan.left > 0)),
    pro: count((r) => Boolean(r.plan?.pro && r.plan.left > 0)),
    ended: count((r) => r.plan?.left === 0),
    unconfirmed: count((r) => !r.confirmed_at),
    notOpened: count((r) => Boolean(r.confirmed_at) && !r.plan),
    sold7: count((r) => r.sales_7d > 0),
    sold30: count((r) => r.sales_30d > 0),
    soldEver: count((r) => r.sales > 0),
    stocked: count((r) => r.products > 0),
  };
}

/** The operator's overview of every account. Only profiles marked is_admin get here; others see a 404. */
export default async function AdminPage() {
  const [{ supabase }, profile] = await Promise.all([getSession(), getProfile()]);
  if (!profile.is_admin) notFound();
  const { data: accounts, error } = await supabase.rpc("admin_accounts");
  if (error) throw new Error(describeError(error));

  const tz = profile.timezone;
  const date = (iso: string) => formatDateTime(iso, tz, "date");
  const { rows, setUp, trial, pro, ended, unconfirmed, notOpened, sold7, sold30, soldEver, stocked } = overview(accounts);
  const share = (n: number) => (setUp ? ` · ${Math.round((n / setUp) * 100)}%` : "");

  return (
    <main className="flex min-h-dvh justify-center px-2 py-6 sm:px-4">
      <section className="window window-shadow flex w-full max-w-6xl flex-col self-start">
        <TitleBar title="KASSIX admin" icon={ShieldCheck} />
        <div className="flex flex-col gap-4 p-3 sm:p-4">
          <section aria-label="Accounts" className="flex flex-col gap-2">
            <h2 className="font-bold">Accounts</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Lcd label="Registered" value={rows.length} />
              <Lcd label="Free trial" value={trial} />
              <Lcd label="KASSIX Pro" value={pro} />
              <Lcd label="Ended (locked)" value={ended} />
            </div>
            <p className="text-[12px] text-neutral-600">
              {unconfirmed} haven&apos;t confirmed their email yet; {notOpened} confirmed but haven&apos;t opened KASSIX
              (no business set up).
            </p>
          </section>

          <section aria-label="Usage" className="flex flex-col gap-2">
            <h2 className="font-bold">Usage</h2>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Lcd label={`Sold in the last 7 days${share(sold7)}`} value={sold7} />
              <Lcd label={`Sold in the last 30 days${share(sold30)}`} value={sold30} />
              <Lcd label={`Made a sale${share(soldEver)}`} value={soldEver} />
              <Lcd label={`Added products${share(stocked)}`} value={stocked} />
            </div>
            <p className="text-[12px] text-neutral-600">
              Percentages are of the {setUp} businesses set up. Voided sales don&apos;t count.
            </p>
          </section>

          <div className="sunken overflow-x-auto">
            <table className="listview">
              <thead>
                <tr>
                  <th>Business</th>
                  <th className="hidden md:table-cell">Email</th>
                  <th>Plan</th>
                  <th className="hidden md:table-cell">Signed up</th>
                  <th className="hidden lg:table-cell">Last sign-in</th>
                  <th className="text-right">Products</th>
                  <th className="text-right">Sales</th>
                  <th className="hidden sm:table-cell">Last sale</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  // Phones show it under the business name, so the plan stays in view.
                  const email = (
                    <>
                      <a href={`mailto:${r.email}`} className="break-all">
                        {r.email}
                      </a>
                      {!r.confirmed_at && <div className="text-[12px] font-bold text-brand">Email not confirmed</div>}
                    </>
                  );
                  return (
                    <tr key={r.user_id}>
                      <td>
                        <div className="font-bold">{r.business_name || "—"}</div>
                        {r.owner_name && <div className="text-[12px] text-neutral-600">{r.owner_name}</div>}
                        <div className="text-[12px] md:hidden">{email}</div>
                      </td>
                      <td className="hidden text-[13px] md:table-cell">{email}</td>
                      <td className="text-[13px] md:whitespace-nowrap">
                        {r.plan ? (
                          <>
                            <div className={cx("font-bold", r.plan.left === 0 ? "text-brand" : r.plan.pro && "text-ok")}>
                              {r.plan.name}
                              {r.plan.left === 0 && " ended"}
                            </div>
                            <div className="text-[12px] text-neutral-600">
                              {r.plan.left === 0
                                ? date(r.plan.endsAt)
                                : `${days(r.plan.left)} left · until ${date(r.plan.endsAt)}`}
                            </div>
                          </>
                        ) : (
                          <span className="text-neutral-600">Not set up yet</span>
                        )}
                      </td>
                      <td className="hidden text-[13px] whitespace-nowrap md:table-cell">{date(r.signed_up_at)}</td>
                      <td className="hidden text-[13px] whitespace-nowrap lg:table-cell">
                        {r.last_sign_in_at ? date(r.last_sign_in_at) : "Never"}
                      </td>
                      <td className="text-right tabular-nums">{r.products}</td>
                      <td className="text-right tabular-nums">
                        {r.sales}
                        <div className="text-[12px] whitespace-nowrap text-neutral-600">{r.sales_30d} in 30 days</div>
                      </td>
                      <td className="hidden text-[13px] whitespace-nowrap sm:table-cell">
                        {r.last_sale_at ? date(r.last_sale_at) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Link href="/dashboard" className="btn">
              <LayoutDashboard aria-hidden size={16} /> Back to KASSIX
            </Link>
          </div>
        </div>
        <div className="statusbar">
          <span className="flex-1">
            {rows.length} account{rows.length === 1 ? "" : "s"} · dates in {tz.replaceAll("_", " ")}
          </span>
        </div>
      </section>
    </main>
  );
}
