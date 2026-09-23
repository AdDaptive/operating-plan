"use client";

import { useRouter } from "next/navigation";

/**
 * Mirrors DeleteObjectiveButton/DeleteTaskButton. Deleting a key result was
 * already safe at the DB level (key_results.objectiveId and
 * tasks.keyResultId are both ON DELETE CASCADE), but nothing in the UI ever
 * called DELETE /api/key-results/[id] -- this is what actually exposes it.
 */
export default function DeleteKeyResultButton({
  keyResultId,
  taskCount,
}: {
  keyResultId: string;
  taskCount: number;
}) {
  const router = useRouter();

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const detail = taskCount > 0 ? ` This also deletes ${taskCount} task${taskCount === 1 ? "" : "s"}.` : "";
    if (!window.confirm(`Delete this key result?${detail} This can't be undone.`)) return;
    await fetch(`/api/key-results/${keyResultId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      onClick={onClick}
      aria-label="Delete key result"
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
