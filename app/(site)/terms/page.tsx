import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { formatNumber } from "@/lib/format";
import { PLANS, TRIAL_DAYS } from "@/lib/trial";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Terms & Conditions" };

export default function TermsPage() {
  const { monthly, yearly } = PLANS;
  return (
    <LegalPage title="Terms & Conditions" icon={ScrollText}>
      <p>
        KASSIX is a point-of-sale web application operated by <b>{BUSINESS.name}</b> (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;), a business registered in the Philippines. By creating an account or using KASSIX, you agree
        to these terms.
      </p>

      <h2>1. Your account</h2>
      <ul>
        <li>You must be at least 18 years old and able to enter into a contract.</li>
        <li>Give accurate details when you sign up, and keep your password safe.</li>
        <li>You are responsible for everything done with your account, including by staff you let use it.</li>
      </ul>

      <h2>2. Free trial</h2>
      <p>
        Every new account gets {TRIAL_DAYS} days of KASSIX free, with every feature. No payment details are needed to
        start.
      </p>

      <h2>3. KASSIX Pro and payments</h2>
      <ul>
        <li>
          After the trial, KASSIX Pro costs ₱{formatNumber(monthly.amount)} for {monthly.days} days or ₱
          {formatNumber(yearly.amount)} for {yearly.days} days, in Philippine pesos, as shown before you pay.
        </li>
        <li>
          Payments are processed by PayMongo. We never see or store your card or e-wallet details.
        </li>
        <li>
          Each payment adds its days after your current end date, so paying early never costs you days. Nothing renews
          automatically; you are only charged when you choose to pay.
        </li>
        <li>
          We may change our prices. A change never affects time you have already paid for, and we will announce it on
          this site before it applies.
        </li>
        <li>
          Refunds follow our <Link href="/refunds">Return &amp; Refund Policy</Link>.
        </li>
      </ul>

      <h2>4. When your time runs out</h2>
      <p>
        When your trial or paid time ends, KASSIX is locked until you subscribe. Your records are kept, and everything
        comes back as soon as you pay. You can ask us to export or delete your records at any time.
      </p>

      <h2>5. Your data</h2>
      <p>
        The business records you enter, such as products, prices, stock and sales, belong to you. You allow us to store
        and process them only to run KASSIX for you. Our <Link href="/privacy">Privacy Policy</Link> explains how we
        handle personal information.
      </p>

      <h2>6. Receipts and taxes</h2>
      <p>
        KASSIX receipts are for your records and your customers&apos; convenience. KASSIX is not accredited by the
        Bureau of Internal Revenue (BIR), so its receipts are not official receipts or sales invoices. You are
        responsible for your own tax registration, invoicing and bookkeeping.
      </p>

      <h2>7. Fair use</h2>
      <p>Do not use KASSIX to break the law, and do not try to:</p>
      <ul>
        <li>get into other people&apos;s accounts or data,</li>
        <li>overload, disrupt or break KASSIX or the systems it runs on,</li>
        <li>copy, resell or reverse-engineer KASSIX.</li>
      </ul>

      <h2>8. Availability</h2>
      <p>
        We work to keep KASSIX running and your data safe, but it is provided &ldquo;as is&rdquo;. It may sometimes be
        unavailable because of maintenance, internet problems or outages at our providers. Keep your own copies of
        records you cannot afford to lose. We may improve or change features over time.
      </p>

      <h2>9. Limits on our liability</h2>
      <p>
        As far as Philippine law allows, we are not liable for indirect losses, such as lost sales or profits. Our
        total liability for any claim is limited to what you paid us in the 12 months before the claim.
      </p>

      <h2>10. Ending your account</h2>
      <p>
        You can stop using KASSIX at any time and ask us to delete your account. We may suspend accounts that break
        these terms, and will tell you why where we reasonably can.
      </p>

      <h2>11. Changes to these terms</h2>
      <p>
        We will post any changes on this page and update the date above. If a change is significant, we will also
        tell you by email or in KASSIX.
      </p>

      <h2>12. Governing law</h2>
      <p>These terms are governed by the laws of the Republic of the Philippines.</p>
    </LegalPage>
  );
}
