"use client";

import { useRouter } from "next/navigation";

export default function DeleteObjectiveButton({
  objectiveId,
  keyResultCount,
  taskCount,
  redirectTo,
}: {
  objectiveId: string;
  keyResultCount: number;
  taskCount: number;
  /**
   * Where to send the user after deleting. Pass this on the board detail
   * page -- the current URL stops existing once the objective is gone.
   * Omitted on the objectives grid card, which just refreshes in place.
   */
  redirectTo?: string;
}) {
  const router = useRouter();

  async function onClick(e: React.MouseEvent) {
    // Can be nested inside a Link (the objectives grid card), so stop it
    // from also navigating.
    e.preventDefault();
    e.stopPropagation();
    const detail =
      keyResultCount > 0
        ? ` This also deletes ${keyResultCount} key result${keyResultCount === 1 ? "" : "s"} and ${taskCount} task${taskCount === 1 ? "" : "s"}.`
        : "";
    if (!window.confirm(`Delete this objective?${detail} This can't be undone.`)) return;
    await fetch(`/api/objectives/${objectiveId}`, { method: "DELETE" });
    if (redirectTo) {
      router.push(redirectTo);
    } else {
      router.refresh();
    }
  }

  return (
    <button
      onClick={onClick}
      aria-label="Delete objective"
      className="flex items-center justify-center rounded-lg p-1.5 text-ink-tertiary hover:bg-surface-panel hover:text-status-offTrackText"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path>
        <path d="M10 11v6"></path>
        <path d="M14 11v6"></path>
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"></path>
      </svg>
    </button>
  );
}
