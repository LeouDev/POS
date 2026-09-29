import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui";
import { BUSINESS, USER_GUIDE_PATH } from "@/lib/business";

/** Public pages (home, policies): open to everyone, and what PayMongo reviews before going live. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex h-12 flex-none items-center gap-2 border-b border-shade bg-face px-2 shadow-[inset_0_-1px_#dfdfdf,0_1px_#fff] sm:px-4">
        <Link href="/" aria-label="KASSIX home" className="no-underline">
          <Logo className="text-[22px] leading-none" />
        </Link>
        <nav aria-label="Site" className="ml-auto flex items-center gap-1.5">
          <Link href="/login" className="btn btn-sm">
            Sign in
          </Link>
          {/* The hero has the big sign-up button; phones get just "Sign in" up here. */}
          <Link href="/login?mode=signup" className="btn btn-sm btn-default hidden font-bold sm:inline-flex">
            Start free trial
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-2 py-4 sm:gap-6 sm:px-4 sm:py-8">{children}</main>

      <footer className="border-t border-white bg-face px-3 py-4 text-[12px] shadow-[inset_0_1px_#dfdfdf] sm:px-4">
        <div className="mx-auto flex max-w-5xl flex-col gap-2">
          <nav aria-label="Policies and help" className="flex flex-wrap gap-x-4 gap-y-1">
            <a href={USER_GUIDE_PATH}>User guide</a>
            <Link href="/terms">Terms &amp; Conditions</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/refunds">Return &amp; Refund Policy</Link>
          </nav>
          <p>
            KASSIX is operated by <b>{BUSINESS.name}</b>, {BUSINESS.address}. Questions?{" "}
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          </p>
          <p className="text-neutral-700">© 2026 {BUSINESS.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
