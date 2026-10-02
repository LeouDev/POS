"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      <Printer aria-hidden size={16} /> {label}
    </button>
  );
}
