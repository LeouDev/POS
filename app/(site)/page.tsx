import {
  BookOpen,
  Boxes,
  ChartColumn,
  CircleHelp,
  Crown,
  MonitorSmartphone,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { TitleBar } from "@/components/ui";
import { HOW_TO_VIDEO_ID, USER_GUIDE_PATH } from "@/lib/business";
import { formatNumber } from "@/lib/format";
import { CHECKOUT_METHODS } from "@/lib/paymongo";
import { PLANS, TRIAL_DAYS } from "@/lib/trial";

export const metadata: Metadata = {
  title: { absolute: "KASSIX: simple point of sale for small businesses" },
  description: `A cash register on your computer, tablet or phone. Sell, print receipts, track stock and see your profit. ${TRIAL_DAYS} days free, then ₱${PLANS.monthly.amount} a month.`,
};

const FEATURES: { icon: LucideIcon; color: string; title: string; text: string }[] = [
  {
    icon: ShoppingCart,
    color: "#008000",
    title: "A fast register",
    text: "Tap products to ring up a customer. Take cash, card or GCash, and KASSIX works out the change.",
  },
  {
    icon: ReceiptText,
    color: "#000080",
    title: "A receipt for every sale",
    text: "Print on any printer your device already uses. Every sale is saved with its own receipt number.",
  },
  {
    icon: Boxes,
    color: "#806000",
    title: "Stock that keeps itself",
    text: "Sales take items off your stock automatically. Deliveries and counts are written down, and low stock is flagged.",
  },
  {
    icon: ChartColumn,
    color: "#1084d0",
    title: "Know how you're doing",
    text: "Sales, profit and best sellers for today, this week or this month, by hour or by day.",
  },
  {
    icon: MonitorSmartphone,
    color: "#c08040",
    title: "Works on what you have",
    text: "Runs in the web browser of any computer, tablet or phone. Nothing to install.",
  },
  {
    icon: ShieldCheck,
    color: "#c00000",
    title: "Private and safe",
    text: "Your shop's records are private to your account. Old receipts never change, even when prices do.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "Do I need special equipment?",
    a: "No. Any computer, tablet or phone with internet works.",
  },
  {
    q: "What about receipts and a cash drawer?",
    a: "Both are optional. Print a receipt for any sale on a printer your device can already print to, such as a 58mm or 80mm thermal receipt printer, or just show it on screen. KASSIX doesn't open a cash drawer by itself, so any manual drawer works.",
  },
  {
    q: "Can customers pay with GCash or card?",
    a: "Yes. Take the payment with your own GCash QR code or card terminal as usual, then choose GCash or Card in KASSIX, so your sales list and reports show how every sale was paid. KASSIX doesn't handle your customers' money itself.",
  },
  {
    q: "What happens after the free trial?",
    a: `After ${TRIAL_DAYS} days, KASSIX asks you to subscribe to KASSIX Pro. Your products, sales and reports are kept safe and come back the moment you pay.`,
  },
  {
    q: "Will I be charged automatically?",
    a: "Never. Each payment covers 30 or 365 days, and you choose when to pay again. Paying early doesn't cost you any days.",
  },
  {
    q: "Are KASSIX receipts official receipts?",
    a: "No. KASSIX receipts are for your records and your customers' convenience. KASSIX is not accredited by the BIR, so its receipts are not official receipts or sales invoices.",
  },
];

const methodList = new Intl.ListFormat("en-US", { type: "conjunction" }).format(Object.values(CHECKOUT_METHODS));

export default function HomePage() {
  return (
    <>
      <section aria-labelledby="hero-title" className="window window-shadow">
        <div className="titlebar">
          <Sparkles aria-hidden size={16} className="flex-none" />
          <span className="flex-1">Welcome to KASSIX</span>
        </div>
        {/* minmax(0, …) columns: Safari otherwise sizes the column to the 900px-wide logo and the page zooms out. */}
        <div className="grid grid-cols-1 gap-5 p-3 sm:p-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-center">
          <div className="flex flex-col gap-4">
            <div className="sunken bg-[#e6e4e0] p-2">
              <Image
                src="/kassix-logo.webp"
                alt="KASSIX point of sale system"
                width={900}
                height={257}
                priority
                className="h-auto w-full"
              />
            </div>
            <h1 id="hero-title" className="text-[28px] leading-tight font-bold text-navy sm:text-[34px]">
              Point of sale made simple
            </h1>
            <p className="text-[15px]">
              KASSIX is a cash register on your computer, tablet or phone. Ring up customers, print receipts, keep
              track of stock and see how much you&apos;re making. If you can use a phone, you can use KASSIX.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href="/login?mode=signup" className="btn btn-lg btn-default py-2 whitespace-normal">
                Start your {TRIAL_DAYS}-day free trial
              </Link>
              <Link href="/login" className="btn btn-lg">
                Sign in
              </Link>
            </div>
            <p className="text-[12px]">
              No credit card needed. After the trial, KASSIX Pro is ₱{formatNumber(PLANS.monthly.amount)} a month.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="sunken aspect-video bg-black">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${HOW_TO_VIDEO_ID}`}
                title="How to use KASSIX"
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="size-full"
              />
            </div>
            <p className="text-[13px]">
              <BookOpen aria-hidden size={16} className="mr-1.5 inline align-[-3px] text-navy" />
              Watch how it works, or read the{" "}
              <a href={USER_GUIDE_PATH} className="font-bold">
                step-by-step user guide
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="features-title" className="window">
        <TitleBar as="h2" id="features-title" title="What KASSIX does" icon={ShoppingCart} />
        <ul className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, color, title, text }) => (
            <li key={title} className="flex gap-3">
              <span className="raised flex size-10 flex-none items-center justify-center bg-face">
                <Icon aria-hidden size={22} style={{ color }} />
              </span>
              <div>
                <h3 className="font-bold">{title}</h3>
                <p className="text-[13px]">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="pricing" aria-labelledby="pricing-title" className="window scroll-mt-16">
        <TitleBar as="h2" id="pricing-title" title="Pricing" icon={Crown} />
        <div className="flex flex-col gap-3 p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <fieldset className="groupbox flex flex-col gap-1.5">
              <legend>Free trial</legend>
              <p>
                <span className="text-[26px] leading-none font-bold">₱0</span> for {TRIAL_DAYS} days
              </p>
              <p className="text-[13px]">Every feature, no credit card. Starts when you first sign in.</p>
            </fieldset>
            {(["monthly", "yearly"] as const).map((plan) => (
              <fieldset key={plan} className="groupbox flex flex-col gap-1.5">
                <legend>KASSIX Pro {PLANS[plan].label.toLowerCase()}</legend>
                <p>
                  <span className="text-[26px] leading-none font-bold">₱{formatNumber(PLANS[plan].amount)}</span> /{" "}
                  {PLANS[plan].per}
                </p>
                <p className="text-[13px]">
                  {PLANS[plan].days} days of every feature
                  {plan === "yearly" && (
                    <>
                      , <b>2 months free</b>
                    </>
                  )}
                  .
                </p>
              </fieldset>
            ))}
          </div>
          <p className="text-[13px]">
            All prices are in Philippine pesos. Pay with {methodList} through PayMongo. Nothing renews automatically:
            you only pay when you choose to. See our <Link href="/refunds">Return &amp; Refund Policy</Link>.
          </p>
        </div>
      </section>

      <section aria-labelledby="faq-title" className="window">
        <TitleBar as="h2" id="faq-title" title="Questions" icon={CircleHelp} />
        <dl className="flex flex-col gap-3 p-3 sm:p-4">
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt className="font-bold">{q}</dt>
              <dd className="text-[13px]">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="flex flex-col items-center gap-3 py-2 text-center text-white">
        <p className="text-[18px] font-bold">Ready to try KASSIX in your shop?</p>
        <Link href="/login?mode=signup" className="btn btn-lg btn-default py-2 whitespace-normal">
          Start your {TRIAL_DAYS}-day free trial
        </Link>
      </section>
    </>
  );
}
