"use client";

import { useState } from "react";

/**
 * The "Preview" / "Send" pair next to one person on the Team page --
 * lets you check or trigger that specific person's daily digest without
 * running it for everyone.
 */
export default function TeamMemberDigestActions({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSend() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/digest/send-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data.error ?? "Couldn't send.");
      } else if (data.result?.ownItemCount === 0 && data.result?.teamFlagCount === 0) {
        setMessage("Nothing to send — no overdue/due-soon/flagged items right now.");
      } else if (data.result) {
        const channels = [
          data.result.emailSent && "email",
          data.result.slackSent && "Slack",
        ].filter(Boolean);
        setMessage(
          channels.length > 0
            ? `Sent via ${channels.join(" + ")}.`
            : "Nothing was actually sent — neither email nor Slack is configured yet (check the server console)."
        );
      } else {
        setMessage("Couldn't find that person.");
      }
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 7000);
    }
  }

  return (
    <div className="relative flex items-center gap-1.5">
      <a
        href={`/api/digest/preview?userId=${userId}`}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054] hover:bg-surface-panel"
      >
        Preview
      </a>
      <button
        onClick={onSend}
        disabled={loading}
        className="rounded-md border border-[#D0D5DD] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#344054] hover:bg-surface-panel disabled:opacity-60"
      >
        {loading ? "Sending…" : "Send"}
      </button>
      {message && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-10 w-60 rounded-lg border border-line bg-white p-2.5 text-[11.5px] leading-relaxed text-ink-secondary shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
