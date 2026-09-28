"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" className="btn" onClick={() => window.print()}>
      <Printer aria-hidden size={16} /> Print
    </button>
  );
}
