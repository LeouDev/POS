import { FileQuestion } from "lucide-react";
import Link from "next/link";
import { TitleBar } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-3">
      <section className="window window-shadow w-full max-w-md">
        <TitleBar title="KASSIX" />
        <div className="flex gap-3 p-4">
          <FileQuestion aria-hidden size={36} className="flex-none text-navy" />
          <div>
            <p className="font-bold">We couldn&apos;t find that page.</p>
            <p className="text-[13px]">It may have been moved, or the link is wrong.</p>
          </div>
        </div>
        <div className="flex justify-end px-4 pb-4">
          <Link href="/dashboard" className="btn btn-default min-w-24">
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
