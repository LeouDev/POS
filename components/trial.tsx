"use client";

import { CalendarClock, Crown } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { cx } from "@/components/ui";
import { trialDaysLeft } from "@/lib/trial";

const subscribeHourly = (callback: () => void) => {
  const id = setInterval(callback, 3_600_000);
  return () => clearInterval(id);
};

/** Days of access left, counted in the browser; null while server rendering. */
function useDaysLeft(endsAt: string) {
  return useSyncExternalStore(subscribeHourly, () => trialDaysLeft(endsAt, Date.now()), () => null);
}

const daysText = (days: number) => `${days} day${days === 1 ? "" : "s"} left`;

/** Days left; when time runs out while KASSIX is open, re-renders the layout, which sends the owner to /billing. */
function usePlanDays(endsAt: string) {
  const days = useDaysLeft(endsAt);
  const router = useRouter();
  useEffect(() => {
    if (days === 0) router.refresh();
  }, [days, router]);
  return days;
}

/** Taskbar tray cell next to the clock: trial or KASSIX Pro days left, red in the final week. */
export function PlanTray({ endsAt, pro }: { endsAt: string; pro: boolean }) {
  const days = usePlanDays(endsAt);
  if (days === null) return null;
  const Icon = pro ? Crown : CalendarClock;
  return (
    <Link
      href="/billing"
      title={pro ? "Your KASSIX Pro plan" : "Your free trial"}
      className={cx(
        "flex h-8 flex-none items-center gap-1.5 border [border-color:#808080_#fff_#fff_#808080] px-2 text-[12px] text-black no-underline lg:h-7",
        days <= 7 && "font-bold text-brand",
      )}
    >
      <Icon aria-hidden size={14} className="flex-none" />
      {days === 0 ? (
        "Ended"
      ) : (
        <>
          <span className="sm:hidden">{days}d left</span>
          <span className="hidden sm:inline">
            {pro ? "Pro" : "Free trial"}: {daysText(days)}
          </span>
        </>
      )}
    </Link>
  );
}

/** White/Black: the trial or KASSIX Pro chip (sidebar, More sheet, phone dashboard), red in the final week. */
export function PlanChip({ endsAt, pro, short, className }: { endsAt: string; pro: boolean; short?: boolean; className?: string }) {
  const days = usePlanDays(endsAt);
  if (days === null) return null;
  const Icon = pro ? Crown : CalendarClock;
  return (
    <Link
      href="/billing"
      title={pro ? "Your KASSIX Pro plan" : "Your free trial"}
      className={cx(
        "flex flex-none items-center gap-2 text-[13px] font-semibold no-underline",
        days <= 7 ? "!text-[var(--red)]" : "!text-[var(--tint)]",
        className,
      )}
    >
      <Icon aria-hidden size={15} className="flex-none" />
      {days === 0 ? "Ended" : short ? `${days}d left` : `${pro ? "Pro" : "Free trial"}: ${daysText(days)}`}
    </Link>
  );
}

/** "(58 days left)", for next to a server-rendered end date. */
export function DaysLeft({ endsAt }: { endsAt: string }) {
  const days = useDaysLeft(endsAt);
  if (days === null) return null;
  return <span className={cx(days <= 7 && "font-bold text-brand")}>({days === 0 ? "ended" : daysText(days)})</span>;
}
