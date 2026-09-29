"use client";

import { CircleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { cx } from "@/components/ui";
import { formatNumber } from "@/lib/format";
import { PLANS, type Plan } from "@/lib/trial";
import { startCheckout } from "./actions";

export function PayButtons() {
  const [state, action] = useActionState(startCheckout, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state?.error && (
        <div role="alert" className="flex items-start gap-2 border border-brand bg-[#fff0f0] p-2 text-[13px]">
          <CircleAlert aria-hidden size={18} className="flex-none text-brand" />
          <span>{state.error}</span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(PLANS) as Plan[]).map((plan) => (
          <PlanOption key={plan} plan={plan} />
        ))}
      </div>
    </form>
  );
}

function PlanOption({ plan }: { plan: Plan }) {
  const { pending, data } = useFormStatus();
  const { label, amount, days, per } = PLANS[plan];
  const price = `₱${formatNumber(amount)}`;
  return (
    <fieldset className="groupbox flex flex-col gap-2">
      <legend>{label}</legend>
      <p>
        <span className="text-[26px] leading-none font-bold">{price}</span> / {per}
      </p>
      <p className="text-[12px]">
        {days} days of KASSIX Pro
        {plan === "yearly" && (
          <>
            , <b>2 months free</b>
          </>
        )}
      </p>
      <button
        type="submit"
        name="plan"
        value={plan}
        disabled={pending}
        className={cx("btn mt-auto", plan === "yearly" && "btn-default")}
      >
        {pending && data?.get("plan") === plan ? "Opening PayMongo…" : `Pay ${price}`}
      </button>
    </fieldset>
  );
}

/** Re-renders the page every few seconds while PayMongo confirms a payment; the page drops it once recorded. */
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
