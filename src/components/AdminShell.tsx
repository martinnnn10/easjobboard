"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";

export type NavItem = { key: string; label: string; href: string };

/**
 * Authenticated app shell: a persistent left sidebar on desktop, an off-canvas
 * drawer on mobile, and a minimal top bar. The current section is highlighted.
 * Server layout passes the resolved nav (already role-filtered) + identity.
 */
export function AdminShell({
  orgSlug,
  orgName,
  platformName,
  userName,
  roleLabel,
  nav,
  isDemo = false,
  children,
}: {
  orgSlug: string;
  orgName: string;
  platformName: string;
  userName: string;
  roleLabel: string;
  nav: NavItem[];
  isDemo?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [open, setOpen] = useState(false);
  const [first, ...rest] = platformName.split(" ");

  const dashboardHref = `/o/${orgSlug}/admin`;
  function isActive(href: string): boolean {
    if (href === dashboardHref) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      {nav.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.key}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-600 text-white"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            <NavIcon name={item.key} className={`h-[18px] w-[18px] shrink-0 ${active ? "text-white" : "text-zinc-400"}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)]">
      {/* Minimal top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4">
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setOpen((v) => !v)}
          className="rounded-md p-1.5 text-zinc-600 hover:bg-zinc-100 md:hidden"
        >
          <NavIcon name="menu" className="h-5 w-5" />
        </button>
        <Link href={dashboardHref} className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/eas-mark.svg" alt="" width={26} height={26} className="shrink-0" />
          <span className="text-base font-extrabold leading-none tracking-tight">
            <span className="text-zinc-800">{first}</span>
            {rest.length ? <span className="text-brand-600"> {rest.join(" ")}</span> : null}
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {isDemo ? (
            <span className="hidden items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
              Demo data
            </span>
          ) : null}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-zinc-800">{orgName}</p>
            <p className="text-xs leading-tight text-zinc-500">
              {userName} · {roleLabel}
            </p>
          </div>
          <LogoutButton orgSlug={orgSlug} label="Sign out" className="btn-secondary px-3 py-1.5 text-sm" />
        </div>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden w-60 shrink-0 border-r border-zinc-200 bg-white md:block">
          <div className="sticky top-14">{sidebar}</div>
        </aside>

        {/* Mobile drawer */}
        {open ? (
          <div className="fixed inset-0 z-20 md:hidden">
            <div className="absolute inset-0 bg-zinc-900/40" onClick={() => setOpen(false)} aria-hidden />
            <aside className="absolute left-0 top-14 h-[calc(100%-3.5rem)] w-60 border-r border-zinc-200 bg-white shadow-xl">
              {sidebar}
            </aside>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

/** Compact stroke icons (currentColor) so nav reads like a product, not a demo. */
function NavIcon({ name, className }: { name: string; className?: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </>
    ),
    queue: (
      <>
        <path d="M15.5 10.5a6 6 0 0 1-6 6l-.7-.1a1 1 0 0 0-1 .5l-1 1.7a13 13 0 0 1-4.4-4.4l1.7-1a1 1 0 0 0 .5-1l-.1-.7a6 6 0 0 1 6-6" />
        <circle cx="17" cy="7" r="3" />
      </>
    ),
    jobs: (
      <>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      </>
    ),
    applicants: (
      <>
        <path d="M14 6h6M14 10h6M14 14h4" />
        <circle cx="7" cy="8" r="2.5" />
        <path d="M3.5 18a3.5 3.5 0 0 1 7 0" />
      </>
    ),
    pipeline: (
      <>
        <rect x="3" y="4" width="4" height="16" rx="1" />
        <rect x="10" y="4" width="4" height="10" rx="1" />
        <rect x="17" y="4" width="4" height="13" rx="1" />
      </>
    ),
    candidates: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M4 19a5 5 0 0 1 10 0" />
        <path d="M16 11a3 3 0 0 0 0-6" />
        <path d="M18 19a5 5 0 0 0-3-4.6" />
      </>
    ),
    outreach: (
      <>
        <path d="M3 11l16-6-4 15-4-6-8-3z" />
        <path d="M11 14l4-4" />
      </>
    ),
    reports: (
      <>
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      </>
    ),
    care: (
      <>
        <path d="M12 21s-7-4.5-9.5-9A4.5 4.5 0 0 1 12 6.5 4.5 4.5 0 0 1 21.5 12c-2.5 4.5-9.5 9-9.5 9z" />
        <path d="M3 12h4l1.5-3 2.5 5 1.5-3H21" />
      </>
    ),
    team: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 19a6 6 0 0 1 12 0" />
        <path d="M16 11a3 3 0 0 0 0-6" />
        <path d="M21 19a5 5 0 0 0-4-4.9" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-2.82 1.17V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 11 4.6h.09A2 2 0 1 1 15 4.6V4.7a1.65 1.65 0 0 0 1 1.4 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 11h.1a2 2 0 1 1 0 4h-.1z" />
      </>
    ),
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {paths[name] ?? paths.dashboard}
    </svg>
  );
}
