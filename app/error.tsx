"use client";

import { ErrorWindow } from "@/components/error-window";

// Catches failures in the signed-in layout itself (e.g. Supabase unreachable).
export default function RootError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="flex min-h-dvh p-3">
      <ErrorWindow {...props} />
    </div>
  );
}
