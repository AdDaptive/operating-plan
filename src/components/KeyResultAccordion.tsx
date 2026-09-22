"use client";

import { useState, type ReactNode } from "react";

/**
 * Collapsible wrapper for a key-result card on the Key Results page (and,
 * potentially, the board page). The header content (title, owner, due date,
 * progress bar, status badge, edit button) is passed in as `header` and
 * rendered exactly where it always was -- only a dedicated chevron button is
 * the toggle target, so clicks on the edit button or other header controls
 * never get swallowed by the accordion. `children` (the task table) is only
 * rendered while open. Defaults to open so nothing changes visually on
 * first load; the user collapses what they don't need.
 */
export default function KeyResultAccordion({
  header,
  taskCount,
  defaultOpen = true,
  children,
}: {
  header: ReactNode;
  taskCount: number;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-[#EEF0F3] px-5 py-4">
        <div className="flex flex-1 flex-wrap items-center justify-between gap-y-2">{header}</div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Collapse tasks" : `Expand tasks (${taskCount})`}
          className="ml-3 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-ink-tertiary transition hover:bg-surface-panel hover:text-ink"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
      {open && children}
    </div>
  );
}
