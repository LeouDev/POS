"use client";

import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; message: string };

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});
export const useToast = () => useContext(ToastContext);

const TONES = {
  success: { title: "Done", icon: CircleCheck, color: "text-ok" },
  error: { title: "Error", icon: CircleAlert, color: "text-brand" },
  info: { title: "Notice", icon: Info, color: "text-navy" },
} as const;

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((all) => all.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (message: string, tone: Tone = "success") => {
      const id = nextId++;
      setToasts((all) => [...all.slice(-2), { id, tone, message }]);
      setTimeout(() => dismiss(id), tone === "error" ? 8000 : 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext value={toast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed top-2 left-1/2 z-[70] flex w-[min(360px,calc(100vw-16px))] -translate-x-1/2 flex-col gap-2"
      >
        {toasts.map((t) => {
          const { title, icon: Icon, color } = TONES[t.tone];
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : undefined}
              className="window window-shadow pointer-events-auto relative"
            >
              <div className="titlebar ios:absolute ios:top-2 ios:right-2">
                <span className="flex-1 ios:sr-only">{title}</span>
                <button
                  type="button"
                  className="titlebar-button ios:!size-7 ios:!border-0 ios:!bg-[var(--fill)] ios:!text-[17px] ios:!shadow-none"
                  aria-label="Dismiss"
                  onClick={() => dismiss(t.id)}
                >
                  ×
                </button>
              </div>
              <div className="flex items-start gap-3 p-3 ios:py-3.5 ios:pr-11 ios:pl-4">
                <Icon aria-hidden size={22} className={`flex-none ${color}`} />
                <p className="pt-0.5">{t.message}</p>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}
