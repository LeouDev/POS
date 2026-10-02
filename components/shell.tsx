"use client";

import {
  Boxes,
  ChartColumn,
  ChevronRight,
  Ellipsis,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  Settings,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { signOut } from "@/app/login/actions";
import { Dialog } from "@/components/dialog";
import { ThemeContext } from "@/components/theme";
import { PlanChip, PlanTray } from "@/components/trial";
import { cx, Logo } from "@/components/ui";
import type { UiTheme } from "@/lib/database.types";
import { initials } from "@/lib/format";

const NAV: { href: string; label: string; icon: LucideIcon; color: string }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, color: "#c00000" },
  { href: "/sale", label: "New Sale", icon: ShoppingCart, color: "#008000" },
  { href: "/sales", label: "Sales", icon: ReceiptText, color: "#000080" },
  { href: "/products", label: "Products", icon: Package, color: "#c08040" },
  { href: "/inventory", label: "Inventory", icon: Boxes, color: "#806000" },
  { href: "/reports", label: "Reports", icon: ChartColumn, color: "#1084d0" },
  { href: "/settings", label: "Settings", icon: Settings, color: "#404040" },
];

const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

type ShellProps = {
  businessName: string;
  email: string;
  timezone: string;
  accessEndsAt: string;
  pro: boolean;
  children: ReactNode;
};

export function Shell({ theme, ...props }: ShellProps & { theme: UiTheme }) {
  // <html> carries the theme too, for what is portalled to <body> (dialogs, toasts) and the page
  // background. Pages outside the app (sign-in, site, billing) never set it, so they stay the original.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (theme === "classic") delete root.dataset.theme;
    else root.dataset.theme = theme;
    return () => {
      delete root.dataset.theme;
    };
  }, [theme]);

  return (
    <ThemeContext value={theme}>
      {theme === "classic" ? <ClassicShell {...props} /> : <IosShell theme={theme} {...props} />}
    </ThemeContext>
  );
}

function ClassicShell({ businessName, email, timezone, accessEndsAt, pro, children }: ShellProps) {
  const pathname = usePathname();
  const current = NAV.find((n) => isActive(pathname, n.href));

  return (
    <div className="flex h-dvh flex-col">
      <a
        href="#main"
        className="btn btn-default absolute top-2 left-2 z-[80] -translate-y-20 focus-visible:translate-y-0"
      >
        Skip to content
      </a>
      <div className="flex min-h-0 flex-1 gap-3 sm:p-2 lg:p-3">
        <nav aria-label="Main" className="window hidden w-56 flex-none flex-col lg:flex">
          <div className="titlebar">
            <span className="flex-1">Programs</span>
          </div>
          <div className="px-3 pt-3 pb-2">
            <Logo className="text-[26px] leading-none" />
            <p className="pixel mt-1 text-[10px] tracking-wide text-navy">Point of sale system</p>
          </div>
          <div className="separator mx-2" />
          <ul className="flex flex-col gap-1 p-2">
            {NAV.map((item) => (
              <li key={item.href}>
                <NavButton item={item} active={isActive(pathname, item.href)} />
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-2 p-2">
            <div className="sunken px-2 py-1.5 text-[12px]">
              <p className="truncate font-bold">{businessName}</p>
              <p className="truncate text-neutral-600">{email}</p>
            </div>
            <form action={signOut}>
              <button type="submit" className="btn w-full justify-start">
                <LogOut aria-hidden size={16} /> Log off
              </button>
            </form>
          </div>
        </nav>
        <main id="main" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col outline-none">
          {children}
        </main>
      </div>
      <Taskbar
        current={current}
        businessName={businessName}
        timezone={timezone}
        accessEndsAt={accessEndsAt}
        pro={pro}
      />
    </div>
  );
}

function NavButton({ item, active, onClick }: { item: (typeof NAV)[number]; active: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className="btn w-full justify-start"
    >
      <Icon aria-hidden size={18} style={{ color: item.color }} />
      <span>{item.label}</span>
    </Link>
  );
}

function Taskbar({
  current,
  businessName,
  timezone,
  accessEndsAt,
  pro,
}: {
  current?: (typeof NAV)[number];
  businessName: string;
  timezone: string;
  accessEndsAt: string;
  pro: boolean;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !startRef.current?.contains(target)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        startRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const CurrentIcon = current?.icon;

  return (
    <div className="relative flex h-11 flex-none items-center gap-1 border-t border-face-light bg-face px-1 shadow-[inset_0_1px_#fff] lg:h-9">
      <button
        ref={startRef}
        type="button"
        className="btn btn-sm !min-h-8 gap-1.5 font-bold lg:!min-h-7"
        aria-expanded={open}
        aria-controls="start-menu"
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden className="size-3.5 border border-black bg-[linear-gradient(135deg,#c00000_0_50%,#000080_50%)]" />
        Start
      </button>
      <div aria-hidden className="mx-0.5 h-7 border-r border-l border-r-white border-l-shade" />
      {current && CurrentIcon && (
        <span aria-hidden className="btn btn-sm !min-h-8 max-w-44 min-w-0 flex-1 justify-start lg:!min-h-7 [border-color:#000_#fff_#fff_#000] shadow-[inset_1px_1px_#808080]">
          <CurrentIcon aria-hidden size={16} className="flex-none" />
          <span className="truncate">{current.label}</span>
        </span>
      )}
      <div className="flex-1" />
      {current?.href !== "/sale" && (
        <Link href="/sale" className="btn btn-sm !min-h-8 font-bold lg:hidden">
          <ShoppingCart aria-hidden size={16} className="text-ok" /> Sell
        </Link>
      )}
      <PlanTray endsAt={accessEndsAt} pro={pro} />
      <Clock timezone={timezone} />

      {open && (
        <div
          id="start-menu"
          ref={menuRef}
          className="window window-shadow absolute bottom-full left-0.5 z-50 mb-0.5 flex"
        >
          <div className="flex w-7 items-end justify-center bg-[linear-gradient(0deg,#000080,#1084d0)] py-2">
            <span className="pixel rotate-180 text-[15px] font-bold tracking-wider text-white [writing-mode:vertical-rl]">
              KASSI<span className="text-face">X</span>
            </span>
          </div>
          <nav aria-label="Start menu" className="flex min-w-60 flex-col py-1">
            <p className="truncate px-3 pb-1 text-[12px] text-neutral-600">{businessName}</p>
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  aria-current={current?.href === item.href ? "page" : undefined}
                  className={cx("menu-item flex min-h-11 items-center gap-3 px-3 text-black no-underline lg:min-h-9", current?.href === item.href && "font-bold")}
                >
                  <Icon aria-hidden size={20} style={{ color: item.color }} />
                  {item.label}
                </Link>
              );
            })}
            <div className="separator mx-1 my-1" />
            <form action={signOut}>
              <button type="submit" className="menu-item flex min-h-11 w-full items-center gap-3 px-3 text-left lg:min-h-9">
                <LogOut aria-hidden size={20} /> Log off…
              </button>
            </form>
          </nav>
        </div>
      )}
    </div>
  );
}

function subscribeMinute(callback: () => void) {
  const id = setInterval(callback, 15_000);
  return () => clearInterval(id);
}

function Clock({ timezone }: { timezone: string }) {
  const time = useSyncExternalStore(
    subscribeMinute,
    () => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timezone }).format(new Date()),
    () => "",
  );
  return (
    <div className="hidden h-8 min-w-20 items-center justify-center border [border-color:#808080_#fff_#fff_#808080] px-2 text-[12px] tabular-nums sm:flex lg:h-7">
      {time}
    </div>
  );
}

// White and Black: a floating glass sidebar on iPad and desktop; on phones a glass tab bar, a Sell
// button and a More sheet. Content sits on opaque cards; glass is only used on this floating chrome.
const TABS = ["/dashboard", "/sales", "/products"];

function IosShell({ theme, businessName, email, accessEndsAt, pro, children }: Omit<ShellProps, "timezone"> & { theme: UiTheme }) {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const onMore = !NAV.some((n) => TABS.includes(n.href) && isActive(pathname, n.href)) && !isActive(pathname, "/sale");

  return (
    <div data-theme={theme} className="flex h-dvh">
      <a
        href="#main"
        className="btn btn-default absolute top-2 left-2 z-[80] -translate-y-20 focus-visible:translate-y-0"
      >
        Skip to content
      </a>
      <nav aria-label="Main" className="glass m-3 mr-0 hidden w-[236px] flex-none flex-col gap-0.5 rounded-[28px] px-3 pt-5 pb-3 lg:flex">
        <div className="flex flex-col gap-[3px] px-3 pb-4">
          <IosLogo />
          <span className="text-[12px] font-medium text-[var(--label2)]">Point of sale system</span>
        </div>
        <ul className="flex flex-col gap-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(pathname, item.href) ? "page" : undefined}
                  className="flex h-10 items-center gap-3 rounded-[14px] px-3 text-[15px] font-medium !text-[var(--label)] no-underline hover:bg-[var(--fill)] aria-[current=page]:bg-[var(--sel)] aria-[current=page]:font-semibold aria-[current=page]:!text-[var(--tint)]"
                >
                  <Icon aria-hidden size={19} className="flex-none" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="flex-1" />
        <PlanChip
          endsAt={accessEndsAt}
          pro={pro}
          className="mx-1 mb-2 rounded-[14px] bg-[color-mix(in_srgb,currentColor_12%,transparent)] px-3 py-2"
        />
        <Account businessName={businessName} email={email} />
      </nav>

      <main
        id="main"
        tabIndex={-1}
        className="flex min-h-0 min-w-0 flex-1 flex-col outline-none max-lg:pb-[calc(72px+max(16px,env(safe-area-inset-bottom)))]"
      >
        {children}
      </main>

      <div className="fixed inset-x-4 bottom-[max(16px,env(safe-area-inset-bottom))] z-30 flex items-center gap-2.5 lg:hidden">
        <nav aria-label="Main" className="glass grid h-16 flex-1 grid-cols-4 items-center rounded-full px-1.5">
          {NAV.filter((n) => TABS.includes(n.href)).map((item) => (
            <Tab key={item.href} href={item.href} icon={item.icon} label={item.label} active={isActive(pathname, item.href)} />
          ))}
          <Tab icon={Ellipsis} label="More" active={onMore || more} onClick={() => setMore(true)} />
        </nav>
        {!isActive(pathname, "/sale") && (
          <Link
            href="/sale"
            aria-label="New sale"
            className="grid size-16 flex-none place-items-center rounded-full bg-[var(--tint)] !text-white shadow-[0_10px_24px_color-mix(in_srgb,var(--tint)_40%,transparent)]"
          >
            <ShoppingCart aria-hidden size={26} />
          </Link>
        )}
      </div>

      <Dialog open={more} onClose={() => setMore(false)} title="More" width={420}>
        <div className="flex flex-col gap-4 pb-2">
          <Account businessName={businessName} email={email} />
          <PlanChip
            endsAt={accessEndsAt}
            pro={pro}
            className="self-start rounded-full bg-[color-mix(in_srgb,currentColor_12%,transparent)] px-3.5 py-2"
          />
          <ul className="card overflow-hidden pl-[18px]">
            {NAV.filter((n) => !TABS.includes(n.href) && n.href !== "/sale").map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href} className="border-b-[0.5px] border-[var(--sep)] last:border-b-0">
                  <Link
                    href={item.href}
                    onClick={() => setMore(false)}
                    aria-current={isActive(pathname, item.href) ? "page" : undefined}
                    className="flex h-[50px] items-center gap-3 pr-4 text-[17px] !text-[var(--label)] no-underline"
                  >
                    <Icon aria-hidden size={20} className="flex-none text-[var(--tint)]" />
                    <span className="flex-1">{item.label}</span>
                    <ChevronRight aria-hidden size={16} className="text-[var(--label3)]" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <form action={signOut}>
            <button type="submit" className="card h-[50px] w-full text-[17px] text-[var(--red)]">
              Log off
            </button>
          </form>
        </div>
      </Dialog>
    </div>
  );
}

function IosLogo() {
  return (
    <span className="text-[25px] leading-none font-extrabold tracking-[-0.02em] text-[var(--label)]">
      KASSI<span className="text-[var(--red)]">X</span>
    </span>
  );
}

function Account({ businessName, email }: { businessName: string; email: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[18px] bg-[var(--fill)] p-2.5">
      <span
        aria-hidden
        className="grid size-[34px] flex-none place-items-center rounded-full bg-[var(--tint)] text-[13px] font-bold text-white"
      >
        {initials(businessName)}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold">{businessName}</span>
        <span className="truncate text-[12px] text-[var(--label2)]">{email}</span>
      </div>
      <form action={signOut} className="flex">
        <button type="submit" aria-label="Log off" title="Log off" className="grid size-8 place-items-center rounded-full text-[var(--label2)]">
          <LogOut aria-hidden size={17} />
        </button>
      </form>
    </div>
  );
}

function Tab({
  href,
  icon: Icon,
  label,
  active,
  onClick,
}: {
  href?: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick?: () => void;
}) {
  const className = cx(
    "flex h-[54px] flex-col items-center justify-center gap-[3px] rounded-full text-[10px] no-underline",
    active ? "bg-[var(--sel)] font-semibold !text-[var(--tint)]" : "font-medium !text-[var(--label)]",
  );
  const content = (
    <>
      <Icon aria-hidden size={22} />
      {label}
    </>
  );
  return href ? (
    <Link href={href} aria-current={active ? "page" : undefined} className={className}>
      {content}
    </Link>
  ) : (
    <button type="button" aria-haspopup="dialog" onClick={onClick} className={className}>
      {content}
    </button>
  );
}
