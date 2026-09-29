import { RotateCcw } from "lucide-react";
import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business";
import { TRIAL_DAYS } from "@/lib/trial";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Return & Refund Policy" };

/** Change-of-mind refund window, in days. */
const REFUND_DAYS = 7;

export default function RefundsPage() {
  return (
    <LegalPage title="Return & Refund Policy" icon={RotateCcw}>
      <p>
        KASSIX is an online service, so there is nothing physical to return. This policy explains when we refund
        KASSIX Pro payments.
      </p>

      <h2>Try before you pay</h2>
      <p>
        Every account starts with {TRIAL_DAYS} days free, with every feature, so you can be sure KASSIX fits your shop
        before paying anything.
      </p>

      <h2>No automatic charges</h2>
      <p>
        Each payment buys one period of KASSIX Pro (30 or 365 days). Nothing renews automatically, so you are never
        charged unless you choose to pay.
      </p>

      <h2>When we refund</h2>
      <ul>
        <li>
          <b>Change of mind:</b> ask within {REFUND_DAYS} days of a payment and we will refund that payment in full.
        </li>
        <li>
          <b>Charged twice, or the wrong plan by mistake:</b> we refund the extra or mistaken payment in full.
        </li>
        <li>
          <b>Paid but your KASSIX Pro time was not added:</b> we add the time or refund you in full, whichever you
          prefer.
        </li>
        <li>
          <b>A long outage on our side:</b> if a problem on our end keeps you from using KASSIX for an extended
          period, we extend your plan or refund the unused part.
        </li>
      </ul>

      <h2>How to ask for a refund</h2>
      <p>
        Email {BUSINESS.email} with your account email, the payment date, and the PayMongo payment ID from your
        receipt. We reply within 3 business days. Approved refunds go back to the original payment method through
        PayMongo; your bank or e-wallet may take a few more business days to show them. Once a payment is refunded,
        the KASSIX Pro time it added is removed from your account.
      </p>
    </LegalPage>
  );
}
