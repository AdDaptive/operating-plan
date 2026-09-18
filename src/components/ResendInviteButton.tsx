"use client";

import { useState } from "react";

/** Admin-only re-send for a still-pending (never-activated) account -- Team page. */
export default function ResendInviteButton({ userId }: { userId: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    setStatus("sending");
    setMessage(null);
    const res = await fetch(`/api/admin/users/${userId}/resend-invite`, { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Couldn't resend the invite.");
      return;
    }

    setStatus("done");
    setMessage(data.emailSent ? "Invite resent." : "Link refreshed, but email isn't configured yet.");
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={resend}
        disabled={status === "sending"}
        className="whitespace-nowrap rounded-lg border border-[#D0D5DD] px-3 py-1.5 text-[12px] font-semibold text-ink-secondary transition hover:bg-surface-panel disabled:opacity-60"
      >
        {status === "sending" ? "Resending…" : "Resend invite"}
      </button>
      {message && <span className="text-[11px] text-ink-tertiary">{message}</span>}
    </div>
  );
}
