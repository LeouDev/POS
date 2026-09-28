"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const noSubscribe = () => () => {};

/**
 * Shows its children as usual and keeps a second copy directly under <body>, hidden on screen.
 * The print styles in globals.css print only that copy, so nothing around the receipt (the app
 * shell, a scroll box, an open dialog) can clip it or push it onto a blank page.
 */
export function Printable({ children }: { children: ReactNode }) {
  const onClient = useSyncExternalStore(noSubscribe, () => true, () => false);
  return (
    <>
      {children}
      {onClient && createPortal(<div className="print-copy">{children}</div>, document.body)}
    </>
  );
}
