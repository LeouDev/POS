"use client";

import { CircleX } from "lucide-react";
import { useEffect } from "react";
import { TitleBar } from "@/components/ui";

export function ErrorWindow({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section role="alert" className="window window-shadow m-auto w-full max-w-md">
      <TitleBar title="KASSIX" />
      <div className="flex gap-3 p-4">
        <CircleX aria-hidden size={36} className="flex-none fill-brand text-white" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="font-bold">This screen ran into a problem.</p>
          <p className="text-[13px] break-words">{error.message || "An unexpected error occurred."}</p>
          {error.digest && <p className="text-[12px] text-neutral-600">Reference: {error.digest}</p>}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-4 pb-4">
        <button type="button" className="btn btn-default min-w-24" onClick={() => retry()}>
          Try again
        </button>
        <a href="/dashboard" className="btn min-w-24">
          Dashboard
        </a>
      </div>
    </section>
  );
}
