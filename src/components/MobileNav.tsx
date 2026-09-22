"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import SignOutButton from "./SignOutButton";
import { initials, colorForName } from "@/lib/avatar";
import { NAV_ICONS } from "./Sidebar";

const TABS: { href: string; icon: keyof typeof NAV_ICONS; label: string; match: (path: string) => boolean }[] = [
  { href: "/", icon: "home", label: "Home", match: (p) => p === "/" },
  {
    href: "/objectives",
    icon: "objectives",
    label: "Objectives",
    match: (p) => p === "/objectives" || p.startsWith("/board/"),
  },
  { href: "/key-results", icon: "tasks", label: "Key Results", match: (p) => p === "/key-results" },
  { href: "/team", icon: "team", label: "Team", match: (p) => p === "/team" },
  { href: "/reports", icon: "reports", label: "Reports", match: (p) => p === "/reports" },
];

/**
 * Phones and portrait tablets (below the `md` breakpoint) don't get the
 * always-visible 252px Sidebar -- it's hidden there (see Sidebar.tsx) in
 * favor of this: a slim top bar (brand + a menu button opening a drawer
 * with the objectives list and account/sign-out, the stuff that doesn't
 * fit in a bottom bar) plus a fixed bottom tab bar with the five primary
 * destinations, one tap each -- the standard mobile-app navigation
 * pattern. Both pieces are `md:hidden`, so md+ (where Sidebar takes over)
 * renders neither.
 */
export default function MobileNav({
  objectives,
  user,
}: {
  objectives: { id: string; title: string; progress: number }[];
  user: { name: string; email: string };
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-4 py-2.5 md:hidden">
        <div className="flex items-center gap-2">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[8px] bg-accent font-display text-[13px] font-extrabold text-white">
            A
          </div>
          <span className="font-display text-[14px] font-bold text-ink">AdDaptive</span>
          <span className="rounded-md bg-surface-panel px-1.5 py-0.5 text-[9.5px] font-bold text-ink-secondary">
            OS
          </span>
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-secondary hover:bg-surface-panel"
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex flex-shrink-0 items-stretch justify-around border-t border-line bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        {TABS.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-semibold ${
                active ? "text-accent" : "text-ink-tertiary"
              }`}
            >
              {NAV_ICONS[tab.icon]}
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className="flex h-full w-[280px] max-w-[85vw] flex-col overflow-y-auto bg-white p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-[15px] font-bold text-ink">Menu</span>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-tertiary hover:bg-surface-panel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            <div className="mb-5 flex flex-col gap-0.5">
              <Link
                href="/activity"
                onClick={() => setDrawerOpen(false)}
                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] ${
                  pathname === "/activity"
                    ? "bg-accent-soft font-semibold text-accent"
                    : "font-medium text-[#344054] hover:bg-surface-sunk"
                }`}
              >
                {NAV_ICONS.activity}
                Activity
              </Link>
            </div>

            <div className="mb-2 px-1 text-[10.5px] font-bold tracking-wide text-ink-tertiary">
              OBJECTIVES
            </div>
            <div className="mb-5 flex flex-col gap-2.5 px-1">
              {objectives.length === 0 && (
                <p className="text-[12px] text-ink-tertiary">No objectives yet.</p>
              )}
              {objectives.map((obj) => (
                <Link
                  key={obj.id}
                  href={`/board/${obj.id}`}
                  onClick={() => setDrawerOpen(false)}
                  className="group block"
                >
                  <div className="mb-1 truncate text-[12.5px] font-semibold text-[#344054] group-hover:text-accent">
                    {obj.title}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-grow overflow-hidden rounded-full bg-[#EEF0F3]">
                      <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `${obj.progress}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-ink-tertiary">{obj.progress}%</span>
                  </div>
                </Link>
              ))}
            </div>

            <div className="mt-auto flex flex-col gap-3">
              <div className="flex gap-2 rounded-lg border border-dashed border-[#D0D5DD] bg-[#F9FAFB] p-2.5">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#667085" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 flex-shrink-0">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                <span className="text-[11px] leading-relaxed text-ink-secondary">
                  Reminders auto-send to the task owner and their manager 3 days and 1 day
                  before the due date.
                </span>
              </div>
              <div className="flex items-center gap-2.5 border-t border-[#EEF0F3] px-1 pt-3.5">
                <div
                  className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-white"
                  style={{ background: colorForName(user.name || user.email) }}
                >
                  {initials(user.name || user.email)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12.5px] font-semibold text-ink">{user.name}</div>
                  <div className="truncate text-[10.5px] text-ink-tertiary">{user.email}</div>
                </div>
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
