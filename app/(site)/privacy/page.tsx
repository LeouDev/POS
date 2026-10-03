import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { BUSINESS } from "@/lib/business";
import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" icon={ShieldCheck}>
      <p>
        {BUSINESS.name} operates KASSIX and is responsible for the personal information described here. We follow the
        Data Privacy Act of 2012 (Republic Act No. 10173). This policy explains what we collect, why, and the choices
        you have.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <b>Account details:</b> your email address and password, your business name, your name, and your currency,
          tax and time zone settings. Passwords are stored only in scrambled (hashed) form; we never see them.
        </li>
        <li>
          <b>Business records you enter:</b> products, prices, stock, sales and receipts.
        </li>
        <li>
          <b>Payments:</b> your plan, the amount and date, the type of payment method, and PayMongo&apos;s reference
          numbers. Card and e-wallet details go straight to PayMongo; we never receive them.
        </li>
        <li>
          <b>Technical information:</b> cookies that keep you signed in and confirm your payments, and standard server
          logs (such as IP address, browser type and pages visited) that our hosting provider keeps for security and
          troubleshooting.
        </li>
      </ul>

      <h2>How we use it</h2>
      <ul>
        <li>To run KASSIX, sign you in and keep your account secure.</li>
        <li>To record your payments and how long your plan lasts.</li>
        <li>To send service emails, such as your welcome email and messages about your account.</li>
        <li>To answer your questions and fix problems.</li>
        <li>
          To see how KASSIX is used, for example how many accounts sign up and how many make sales, so we can improve
          it.
        </li>
        <li>To meet our legal obligations.</li>
      </ul>
      <p>We do not sell your information, and we do not use it for advertising.</p>

      <h2>Who helps us run KASSIX</h2>
      <p>These service providers process information for us, only as needed to provide their service:</p>
      <ul>
        <li>Supabase: database and sign-in</li>
        <li>Vercel: website hosting</li>
        <li>PayMongo: payments</li>
        <li>Brevo: email delivery</li>
        <li>YouTube: the how-to video on our home page, shown in privacy-enhanced mode</li>
      </ul>
      <p>
        Some of these providers are outside the Philippines, so your information may be stored or processed in other
        countries, including Japan, Singapore, the United States and the European Union. We only use providers that
        protect it with appropriate safeguards.
      </p>

      <h2>Cookies</h2>
      <p>
        KASSIX only uses cookies it needs to work: to keep you signed in and to confirm payments when you return from
        PayMongo. We do not use advertising or tracking cookies. If you play the video on our home page, YouTube may
        set its own cookies.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep your account and business records while your account exists, including after your plan ends, so you
        can pick up where you left off. If you ask us to delete your account, we delete your account and business
        records within 30 days, except payment records that tax and accounting laws require us to keep.
      </p>

      <h2>How we protect it</h2>
      <p>
        All connections to KASSIX are encrypted. Each business&apos;s records are kept separate by access rules in our
        database, so no other account can see them. Our team can see your account details, your plan and usage totals
        (such as how many products and sales your account has) to run KASSIX and help you.
      </p>

      <h2>Your rights</h2>
      <p>Under the Data Privacy Act, you have the right to:</p>
      <ul>
        <li>be informed about how your information is used,</li>
        <li>access your information and get a copy of it,</li>
        <li>have wrong information corrected,</li>
        <li>object to processing, or have your information blocked or deleted,</li>
        <li>data portability, and to be compensated for damages from misuse,</li>
        <li>file a complaint with the National Privacy Commission.</li>
      </ul>
      <p>To use any of these rights, email our Data Protection Officer at {BUSINESS.email}.</p>

      <h2>Children</h2>
      <p>KASSIX is for businesses and is not meant for anyone under 18.</p>

      <h2>Changes to this policy</h2>
      <p>We will post any changes on this page and update the date above.</p>
    </LegalPage>
  );
}
