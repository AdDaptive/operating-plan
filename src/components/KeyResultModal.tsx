"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PermissionLevel } from "@/lib/db";
import { LEVEL_ORDER, LEVEL_META } from "@/lib/permissions";
import Modal from "./Modal";
import { Field, inputClass } from "./form";

type Existing = {
  id: string;
  title: string;
  dueDate: string;
  ownerId: string;
  level: PermissionLevel;
};

export default function KeyResultModal({
  objectiveId,
  objectiveDueDate,
  users,
  existing,
}: {
  objectiveId: string;
  objectiveDueDate?: string | null;
  users: { id: string; name: string }[];
  existing?: Existing;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? "");
  const [level, setLevel] = useState<PermissionLevel>(existing?.level ?? "EMPLOYEE");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (objectiveDueDate && dueDate && dueDate > objectiveDueDate) {
      setError("A key result's due date can't be after the objective's due date.");
      return;
    }

    setLoading(true);
    const url = existing ? `/api/key-results/${existing.id}` : "/api/key-results";
    const method = existing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dueDate, ownerId: ownerId || null, objectiveId, level }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      {existing ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit key result"
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
          className="flex items-center gap-1.5 rounded-lg border border-[#D0D5DD] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#344054] hover:bg-surface-panel"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Add Key Result
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={existing ? "Edit key result" : "Add key result"}>
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <Field label="Key result">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Increase managed ad spend to $12M"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={inputClass}
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input
                required
                type="date"
                value={dueDate}
                max={objectiveDueDate ?? undefined}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          {objectiveDueDate && (
            <p className="text-[11.5px] text-ink-tertiary">
              Must be on or before the objective&rsquo;s due date ({objectiveDueDate}).
            </p>
          )}
          <Field label="Who can see this">
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as PermissionLevel)}
              className={inputClass}
            >
              {LEVEL_ORDER.map((l) => (
                <option key={l} value={l}>
                  {LEVEL_META[l].label}
                </option>
              ))}
            </select>
          </Field>
          <p className="text-[11.5px] text-ink-tertiary">
            A key result&rsquo;s status isn&rsquo;t set manually -- it&rsquo;s the worst status
            among its tasks (e.g. any task At Risk makes the key result At Risk), and the
            objective&rsquo;s overall progress is the average of its key results&rsquo; statuses.
          </p>
          {error && <p className="text-[13px] text-status-offTrackText">{error}</p>}
          <button
            disabled={loading}
            className="mt-1 rounded-lg bg-accent py-2.5 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Saving…" : existing ? "Save changes" : "Add key result"}
          </button>
        </form>
      </Modal>
    </>
  );
}
