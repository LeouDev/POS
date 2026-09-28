"use client";

import { ErrorWindow } from "@/components/error-window";

export default function PageError(props: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorWindow {...props} />;
}
