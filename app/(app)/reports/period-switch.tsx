"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition, type ReactNode } from "react";

const PERIODS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
] as const;

/** Period buttons; while the next period loads, the current report stays up, dimmed. */
export function PeriodSwitch({ period, children }: { period: string; children: ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <div role="group" aria-label="Report period" className="flex flex-wrap gap-1">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            type="button"
            className="btn"
            aria-pressed={p.value === period}
            onClick={() => startTransition(() => router.push(`/reports?period=${p.value}`))}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div aria-busy={pending} className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {children}
      </div>
    </div>
  );
}

/** White/Black: the period as a glass segmented capsule in the page header; the choice moves at once. */
export function PeriodTabs({ period }: { period: string }) {
  const router = useRouter();
  const [shown, setShown] = useOptimistic(period);
  const [, startTransition] = useTransition();
  return (
    <div role="group" aria-label="Report period" className="glass flex rounded-full p-1">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={p.value === shown}
          onClick={() =>
            startTransition(() => {
              setShown(p.value);
              router.push(`/reports?period=${p.value}`);
            })
          }
          className="h-9 rounded-full px-4 text-[15px] font-medium whitespace-nowrap sm:px-[18px] aria-pressed:bg-[var(--tint)] aria-pressed:font-semibold aria-pressed:text-white"
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
