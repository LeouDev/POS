"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ReactNode } from "react";

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
