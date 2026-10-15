"use client";

import { useRouter } from "next/navigation";

/**
 * Archives an objective or project (tasks are archived from their status
 * dropdown instead). Archiving moves the item -- and everything under it --
 * off the boards, Home, reports, and the daily digest into the Archive page,
 * where it can be restored. Nothing is deleted.
 */
export default function ArchiveButton({
  kind,
  id,
  noun,
  detail,
  redirectTo,
}: {
  kind: "objective" | "keyResult";
  id: string;
  /** "objective" / "project", for the confirm text and aria-label. */
  noun: string;
  /** Extra sentence about what else gets archived along with it. */
  detail?: string;
  /** Where to go afterward (the board page stops existing once its objective is archived). Omit to just refresh. */
  redirectTo?: string;
}) {
  const router = useRouter();

  async function onClick(e: React.MouseEvent) {
    // May sit inside a Link (the objectives grid card), so don't navigate.
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm(`Archive this ${noun}?${detail ? ` ${detail}` : ""} You can restore it from the Archive page.`)) return;
    const res = await fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, action: "archive" }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(data.error ?? `Couldn't archive this ${noun}.`);
      return;
    }
    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  return (
    <button
      onClick={onClick}
      aria-label={`Archive ${noun}`}
      title={`Archive ${noun}`}
      className="flex items-center justify-center rounded-lg p-1.5 text-ink-tertiary hover:bg-surface-panel hover:text-ink-secondary"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="21 8 21 21 3 21 3 8"></polyline>
        <rect x="1" y="3" width="22" height="5"></rect>
        <line x1="10" y1="12" x2="14" y2="12"></line>
      </svg>
    </button>
  );
}
