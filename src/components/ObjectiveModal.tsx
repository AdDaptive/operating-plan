"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputClass } from "./form";

type Existing = {
  id: string;
  title: string;
  team: string;
  dueDate: string;
};

export default function ObjectiveModal({ existing }: { existing?: Existing }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [team, setTeam] = useState(existing?.team ?? "");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const url = existing ? `/api/objectives/${existing.id}` : "/api/objectives";
    const method = existing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      // `team || null` (not `undefined`) so clearing the field to empty on
      // an edit actually clears it -- the PATCH route only skips a field
      // when it's `undefined`, not when it's explicitly `null`.
      body: JSON.stringify({ title, team: team || null, dueDate }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    if (!existing) {
      setTitle("");
      setTeam("");
      setDueDate("");
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {existing ? (
        <button
          onClick={(e) => {
            // ObjectiveModal's edit button can be nested inside a Link
            // (the objectives grid card), so stop it from also navigating.
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          aria-label="Edit objective"
          className="flex items-center justify-center rounded-lg p-1.5 text-ink-tertiary hover:bg-surface-panel hover:text-ink"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
      ) : (
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
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={existing ? "Edit objective" : "New objective"}
      >
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
          <Field label="Due date">
            <input
              required
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </Field>
          {error && <p className="text-[13px] text-status-offTrackText">{error}</p>}
          <button
            disabled={loading}
            className="mt-1 rounded-lg bg-accent py-2.5 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Saving…" : existing ? "Save changes" : "Create objective"}
          </button>
        </form>
      </Modal>
    </>
  );
}
