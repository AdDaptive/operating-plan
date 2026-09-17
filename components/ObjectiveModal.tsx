"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputClass } from "./form";

export default function ObjectiveModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [team, setTeam] = useState("");
  const [quarter, setQuarter] = useState("Q3 2026");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/objectives", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, team: team || undefined, quarter }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setTitle("");
    setTeam("");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-accent-hover"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
        New Objective
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New objective">
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <Field label="Objective">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Grow Programmatic Revenue"
            />
          </Field>
          <Field label="Team">
            <input
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              className={inputClass}
              placeholder="e.g. Revenue & Partnerships"
            />
          </Field>
          <Field label="Quarter">
            <input
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              className={inputClass}
              placeholder="Q3 2026"
            />
          </Field>
          {error && <p className="text-[13px] text-status-offTrackText">{error}</p>}
          <button
            disabled={loading}
            className="mt-1 rounded-lg bg-accent py-2.5 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Creating…" : "Create objective"}
          </button>
        </form>
      </Modal>
    </>
  );
}
