"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Restores an archived objective, project, or task from the Archive page. */
export default function RestoreButton({
  kind,
  id,
  blockedReason,
}: {
  kind: "objective" | "keyResult" | "task";
  id: string;
  /** Set when a parent is still archived, so restoring would put this somewhere invisible. */
  blockedReason?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onClick() {
    setBusy(true);
    try {
      const res = await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, action: "restore" }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        window.alert(data.error ?? "Couldn't restore this item.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onClick}
      disabled={busy || !!blockedReason}
      title={blockedReason}
      className="w-fit rounded-lg border border-line bg-white px-3 py-1.5 text-[12px] font-semibold text-ink-secondary hover:bg-surface-panel disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "Restoring…" : "Restore"}
    </button>
  );
}
