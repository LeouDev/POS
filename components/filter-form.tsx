"use client";

import Form from "next/form";
import type { ReactNode } from "react";

/** GET form that navigates client-side; dropdowns and dates apply as soon as they change. */
export function FilterForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  return (
    <Form
      action={action}
      className={className}
      onChange={(e) => {
        const target: EventTarget = e.target;
        const auto =
          target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === "date");
        if (auto) e.currentTarget.requestSubmit();
      }}
    >
      {children}
    </Form>
  );
}
