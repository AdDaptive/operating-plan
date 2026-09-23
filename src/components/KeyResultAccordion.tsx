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
 *
 * The chevron sits immediately to the left of the key result's own title
 * block (not off at the far right of the card, near the progress bar/status
 * badge) -- `header`'s two original children (title block, progress/status
 * block) keep their own internal justify-between spacing via the nested
 * flex-1 wrapper below; the chevron is a sibling before that wrapper, not
 * part of it.
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
      <div className="flex flex-wrap items-start gap-2 border-b border-[#EEF0F3] px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={open ? "Collapse tasks" : `Expand tasks (${taskCount})`}
          className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-ink-tertiary transition hover:bg-surface-panel hover:text-ink"
        >
          <svg
            width="22"
            height="22"
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
        <div className="flex flex-1 flex-wrap items-center justify-between gap-y-2">{header}</div>
      </div>
      {open && children}
    </div>
  );
}
