"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunDigestButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setMessage(null);
    const res = await fetch("/api/digest/run", { method: "POST" });
    const data = await res.json().catch(() => ({ sent: 0 }));
    setLoading(false);
    setMessage(
      data.sent > 0
        ? `Sent today's digest to ${data.sent} ${data.sent === 1 ? "person" : "people"} (over whichever of email/Slack is configured — see the server console for details).`
        : "Nobody has anything overdue, due soon, or flagged right now — nothing to send."
    );
    router.refresh();
    setTimeout(() => setMessage(null), 8000);
  }

  return (
    <div className="relative">
      <button
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#344054] hover:bg-surface-panel disabled:opacity-60"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
        {loading ? "Sending…" : "Send digest to everyone"}
      </button>
      {message && (
        <div className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-lg border border-line bg-white p-3 text-[12px] leading-relaxed text-ink-secondary shadow-lg">
          {message}
        </div>
      )}
    </div>
  );
}
