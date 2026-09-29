import {
  CalendarClock,
  CircleCheck,
  Crown,
  Hourglass,
  LayoutDashboard,
  LogOut,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { cx, TitleBar } from "@/components/ui";
import { describeError } from "@/lib/actions";
import type { Payment, Profile } from "@/lib/database.types";
import { getProfile, getSession, param } from "@/lib/data";
import { formatDateTime, formatMoney } from "@/lib/format";
import { CHECKOUT_COOKIE, CHECKOUT_METHODS, confirmCheckout } from "@/lib/paymongo";
import { accessEndsAt, hasAccess, isPro, PLANS, TRIAL_DAYS, trialDaysLeft } from "@/lib/trial";
import { AutoRefresh, PayButtons } from "./pay-buttons";

export const metadata: Metadata = { title: "KASSIX Pro" };

const METHOD_LIST = new Intl.ListFormat("en-US", { type: "disjunction" }).format(Object.values(CHECKOUT_METHODS));

async function getPayments() {
  const { supabase } = await getSession();
  const { data, error } = await supabase.from("payments").select("*").order("paid_at", { ascending: false }).limit(100);
  if (error) throw new Error(describeError(error));
  return data;
}

/** Where the account stands; `checkoutAt` is the timestamp PayMongo sends the owner back with. */
function planState(profile: Profile, payments: Payment[], checkoutAt: number, now = Date.now()) {
  const endsAt = accessEndsAt(profile);
  const returned = checkoutAt <= now && checkoutAt > now - 30 * 60_000;
  const recorded = payments.some((p) => Date.parse(p.paid_at) >= checkoutAt);
  return {
    endsAt,
    days: trialDaysLeft(endsAt, now),
    active: hasAccess(profile, now),
    pro: isPro(profile),
    confirming: returned && !recorded,
    justPaid: returned && recorded,
  };
}

/** Back from PayMongo before its webhook: ask PayMongo directly whether the owner's checkout is paid. */
async function confirmWithPayMongo(userId: string, payments: Payment[]) {
  const sessionId = (await cookies()).get(CHECKOUT_COOKIE)?.value;
  // Already recorded (e.g. an older checkout): nothing new to confirm, and no redirect loop.
  if (!sessionId || payments.some((p) => p.checkout_session_id === sessionId)) return false;
  try {
    return await confirmCheckout(sessionId, userId);
  } catch (err) {
    console.error("[paymongo] couldn't confirm checkout", sessionId, err);
    return false; // the webhook still records it
  }
}

/** KASSIX Pro: plan status and payments. The (app) layout sends owners here once their time runs out. */
export default async function BillingPage(props: PageProps<"/billing">) {
  const [{ email, userId }, profile, payments, { checkout }] = await Promise.all([
    getSession(),
    getProfile(),
    getPayments(),
    props.searchParams,
  ]);
  const checkoutAt = Number(param(checkout));
  const s = planState(profile, payments, checkoutAt);
  // Recorded just now: reload so the new end date and payment show.
  if (s.confirming && (await confirmWithPayMongo(userId, payments))) redirect(`/billing?checkout=${checkoutAt}`);
  const date = (iso: string) => formatDateTime(iso, profile.timezone, "date");
  const daysLeft = `${s.days} day${s.days === 1 ? "" : "s"} left`;

  return (
    <main className="flex min-h-dvh items-start justify-center px-2 py-6 sm:items-center sm:px-4">
      <section className="window window-shadow w-full max-w-2xl">
        <TitleBar title="KASSIX Pro" icon={Crown} />
        <div className="flex flex-col gap-4 p-3 sm:p-4">
          {s.confirming ? (
            <Banner icon={Hourglass} title="Confirming your payment…">
              <p>PayMongo is confirming your payment. This page updates by itself, usually within a few seconds.</p>
              <div aria-hidden className="progress-marquee mt-2">
                <span />
              </div>
              <AutoRefresh />
            </Banner>
          ) : s.justPaid ? (
            <Banner icon={CircleCheck} title="Payment received. Thank you!">
              KASSIX Pro is active until <b>{date(s.endsAt)}</b>.
            </Banner>
          ) : !s.active ? (
            <Banner
              alert
              icon={TriangleAlert}
              title={s.pro ? `Your KASSIX Pro time ended on ${date(s.endsAt)}.` : `Your ${TRIAL_DAYS}-day free trial has ended.`}
            >
              Subscribe to KASSIX Pro to keep using KASSIX. Your products, sales and reports are safe and will be right
              where you left them.
            </Banner>
          ) : s.pro ? (
            <Banner icon={Crown} title={`KASSIX Pro: ${daysLeft}`}>
              Paid until <b>{date(s.endsAt)}</b>. Paying again adds time after that date.
            </Banner>
          ) : (
            <Banner icon={CalendarClock} title={`Free trial: ${daysLeft}`}>
              Every feature is free until <b>{date(s.endsAt)}</b>. Subscribe whenever you&apos;re ready: paid time
              starts after your trial, so you keep every free day.
            </Banner>
          )}

          {!s.confirming && (
            <>
              <PayButtons />
              <p className="text-[12px]">
                Pay securely through PayMongo with {METHOD_LIST}. Nothing renews automatically: each payment adds its
                days after your current end date.
              </p>
            </>
          )}

          {payments.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h2 className="font-bold">Payment history</h2>
              <div className="sunken overflow-x-auto">
                <table className="listview">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Plan</th>
                      <th className="hidden sm:table-cell">Paid with</th>
                      <th className="hidden sm:table-cell">Covers</th>
                      <th className="text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td>{date(p.paid_at)}</td>
                        <td>{PLANS[p.plan].label}</td>
                        <td className="hidden sm:table-cell">
                          {CHECKOUT_METHODS[p.method as keyof typeof CHECKOUT_METHODS] ?? p.method ?? "—"}
                        </td>
                        <td className="hidden sm:table-cell">
                          {date(p.period_start)} – {date(p.period_end)}
                        </td>
                        <td className="text-right tabular-nums">{formatMoney(p.amount, "PHP")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            {s.active && (
              <Link href="/dashboard" className="btn">
                <LayoutDashboard aria-hidden size={16} /> Back to KASSIX
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className="btn">
                <LogOut aria-hidden size={16} /> Log off
              </button>
            </form>
          </div>
        </div>
        <div className="statusbar">
          <span className="flex-1 truncate">
            {profile.business_name} · {email}
          </span>
        </div>
      </section>
    </main>
  );
}

function Banner({
  icon: Icon,
  title,
  alert,
  children,
}: {
  icon: LucideIcon;
  title: string;
  alert?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      role={alert ? "alert" : "status"}
      className={cx("flex items-start gap-3 border p-3 text-[13px]", alert ? "border-brand bg-[#fff0f0]" : "border-black bg-tip")}
    >
      <Icon aria-hidden size={28} className={cx("flex-none", alert ? "text-brand" : "text-navy")} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-[15px] font-bold">{title}</p>
        <div>{children}</div>
      </div>
    </div>
  );
}
