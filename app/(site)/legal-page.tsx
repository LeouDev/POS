import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { TitleBar } from "@/components/ui";
import { BUSINESS, POLICIES_UPDATED } from "@/lib/business";

/** A policy page: one window of plain prose, closing with how to reach us. */
export function LegalPage({ title, icon, children }: { title: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <article className="window">
      <TitleBar title={title} icon={icon} />
      <div className="flex max-w-3xl flex-col gap-3 p-3 text-[14px] sm:p-5 [&_h2]:mt-3 [&_h2]:text-[16px] [&_h2]:font-bold [&_h2]:text-navy [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1 [&_ul]:pl-5">
        <p className="text-[12px] text-neutral-700">Last updated {POLICIES_UPDATED}</p>
        {children}
        <h2>Contact us</h2>
        <p>
          {BUSINESS.name}
          <br />
          DTI Business Name No. {BUSINESS.dtiNumber}
          <br />
          {BUSINESS.address}
          <br />
          <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
        </p>
      </div>
    </article>
  );
}
