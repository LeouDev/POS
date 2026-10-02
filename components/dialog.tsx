"use client";

import { TriangleAlert } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { TitleBar } from "@/components/ui";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
  dismissible?: boolean;
  /** White/Black: a round button at the sheet's top right (the close button is at the left). */
  action?: ReactNode;
};

/**
 * Native <dialog> (focus trap, Esc, top layer) dressed as a Win98 window. Mounted only while open
 * (always after a click, so document exists), and portalled to <body> so it doesn't inherit
 * text styles from wherever it was opened, like a centred empty state or a table cell.
 */
export function Dialog({ open, ...props }: DialogProps) {
  return open ? createPortal(<OpenDialog {...props} />, document.body) : null;
}

function OpenDialog({ onClose, title, children, footer, width = 480, dismissible = true, action }: Omit<DialogProps, "open">) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
      // showModal() would focus the × button; prefer [data-autofocus] or the first control.
      (
        dialog.querySelector<HTMLElement>("[data-autofocus]") ??
        dialog.querySelector<HTMLElement>(".dialog-body :is(input, select, textarea, button):not(:disabled)")
      )?.focus();
    }
    // Once really unmounted (not StrictMode's rehearsal), hand focus back to whatever opened it.
    return () => {
      if (!dialog.isConnected) opener.current?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className="win-dialog"
      style={{ width }}
      aria-labelledby={titleId}
      // React bubbles close/cancel through the component tree, so ignore ones from a nested dialog.
      onClose={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onCancel={(e) => {
        if (e.target === e.currentTarget && !dismissible) e.preventDefault();
      }}
    >
      <div className="window window-shadow flex max-h-[calc(100dvh-16px)] flex-col">
        <TitleBar title={title} id={titleId} as="h2">
          <button type="button" className="titlebar-button" aria-label="Close" disabled={!dismissible} onClick={onClose}>
            ×
          </button>
          {action && <div className="absolute top-3 right-3.5">{action}</div>}
        </TitleBar>
        <div className="dialog-body min-h-0 overflow-auto p-3 ios:px-5 ios:pt-1 ios:pb-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 px-3 pb-3 ios:px-5 ios:pb-6">{footer}</div>}
      </div>
    </dialog>
  );
}

/** "Are you sure?" box for destructive actions; stays open and busy while onConfirm runs. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      width={420}
      dismissible={!busy}
      footer={
        <>
          <button type="button" className="btn btn-default btn-danger min-w-24" disabled={busy} onClick={confirm}>
            {busy ? "Working…" : confirmLabel}
          </button>
          <button type="button" className="btn min-w-24" disabled={busy} onClick={onClose} data-autofocus>
            Cancel
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        <TriangleAlert aria-hidden size={32} className="flex-none fill-folder text-black" />
        <div className="pt-1">{children}</div>
      </div>
    </Dialog>
  );
}
