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
  objectives,
  users,
  existing,
}: {
  /** Fixed target objective -- how the board page and every per-key-result
   * edit button already use this component. Omit this and pass `objectives`
   * instead to let the person pick the objective from a dropdown (the Key
   * Results page's header-level "Add Key Result" button, which isn't
   * scoped to any one objective). */
  objectiveId?: string;
  objectiveDueDate?: string | null;
  /** Alternative to a fixed `objectiveId`: every objective the person can
   * choose from, each with its own due date for the "can't be after the
   * objective's due date" validation below. Ignored if `objectiveId` is
   * set, and irrelevant while editing an existing key result (its
   * objective is never reassignable here, same as a task's key result is
   * only reassignable, never its objective, elsewhere in this app). */
  objectives?: { id: string; title: string; dueDate: string | null }[];
  users: { id: string; name: string }[];
  existing?: Existing;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? "");
  const [level, setLevel] = useState<PermissionLevel>(existing?.level ?? "EMPLOYEE");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState(
    objectiveId ?? objectives?.[0]?.id ?? ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolved target objective: the fixed prop when scoped to one objective,
  // otherwise whichever the person picked from the new dropdown.
  const effectiveObjectiveId = objectiveId ?? selectedObjectiveId;
  const effectiveObjectiveDueDate = objectiveId
    ? objectiveDueDate
    : (objectives?.find((o) => o.id === selectedObjectiveId)?.dueDate ?? null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (effectiveObjectiveDueDate && dueDate && dueDate > effectiveObjectiveDueDate) {
      setError("A key result's due date can't be after the objective's due date.");
      return;
    }

    setLoading(true);
    const url = existing ? `/api/key-results/${existing.id}` : "/api/key-results";
    const method = existing ? "PATCH" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          dueDate,
          ownerId: ownerId || null,
          objectiveId: effectiveObjectiveId,
          level,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Something went wrong.");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      // Same fix as TaskModal: a thrown fetch (dropped connection, request
      // timed out) previously left `loading` stuck true forever with the
      // save button just spinning and no feedback at all.
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
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
          {!objectiveId && objectives && (
            <Field label="Objective">
              <select
                required
                value={selectedObjectiveId}
                onChange={(e) => setSelectedObjectiveId(e.target.value)}
                className={inputClass}
              >
                {objectives.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
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
                max={effectiveObjectiveDueDate ?? undefined}
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          {effectiveObjectiveDueDate && (
            <p className="text-[11.5px] text-ink-tertiary">
              Must be on or before the objective&rsquo;s due date ({effectiveObjectiveDueDate}).
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
