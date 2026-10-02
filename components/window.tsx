import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cx, TitleBar } from "@/components/ui";
import { getProfile } from "@/lib/data";

type WindowProps = {
  title: ReactNode;
  icon?: LucideIcon;
  toolbar?: ReactNode;
  status?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** White/Black only: a small caps line over the large title, a line under it, and a filter row below. */
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  filters?: ReactNode;
};

/** A page: a Win98 window in the original look; a large title with capsule actions in White and Black. */
export async function Window(props: WindowProps) {
  const { ui_theme } = await getProfile();
  return ui_theme === "light" || ui_theme === "dark" ? <IosWindow {...props} /> : <ClassicWindow {...props} />;
}

/** A page-level window: title bar, optional toolbar, scrolling body and status bar. */
function ClassicWindow({
  title,
  icon,
  toolbar,
  status,
  children,
  className,
  bodyClassName,
}: WindowProps) {
  return (
    <section className={cx("window flex min-h-0 flex-1 flex-col", className)}>
      <TitleBar title={title} icon={icon} />
      {toolbar && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-shade px-1 py-1.5 shadow-[0_1px_#fff]">
          {toolbar}
        </div>
      )}
      <div className={cx("min-h-0 flex-1 overflow-auto p-2 sm:p-3", bodyClassName)}>{children}</div>
      {status && <div className="statusbar">{status}</div>}
    </section>
  );
}

// Phones: actions sit above the title, as in iOS; wider screens put them at the title's right.
function IosWindow({ title, eyebrow, subtitle, toolbar, filters, status, children, className, bodyClassName }: WindowProps) {
  return (
    <section className={cx("flex min-h-0 flex-1 flex-col", className)}>
      <header className="flex flex-none flex-col gap-2 px-4 pt-3 lg:flex-row lg:items-end lg:gap-3 lg:pt-[26px] lg:pr-7 lg:pl-4">
        <div className="min-w-0 flex-1 max-lg:order-last max-lg:px-1">
          {eyebrow && (
            <p className="mb-0.5 text-[13px] font-semibold tracking-[0.04em] text-[var(--label2)] uppercase">{eyebrow}</p>
          )}
          <h1 className="truncate text-[34px] leading-[1.2] font-bold tracking-[-0.025em]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[15px] text-[var(--label2)]">{subtitle}</p>}
        </div>
        {toolbar && <div className="flex flex-wrap items-center justify-end gap-2">{toolbar}</div>}
      </header>
      {filters && <div className="flex-none px-4 pt-3.5 lg:pr-7 lg:pl-4">{filters}</div>}
      <div className={cx("min-h-0 flex-1 overflow-auto px-4 pt-4 pb-6 lg:pt-[18px] lg:pr-7 lg:pl-4", bodyClassName)}>
        {children}
      </div>
      {status && <div className="statusbar flex-none px-5 pb-3 lg:pr-8 lg:pl-5">{status}</div>}
    </section>
  );
}
