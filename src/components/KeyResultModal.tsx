"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { PermissionLevel, KeyResultActivityField } from "@/lib/db";
import { LEVEL_ORDER, LEVEL_META } from "@/lib/permissions";
import { formatKeyResultActivityValue, KEY_RESULT_ACTIVITY_FIELD_LABELS } from "@/lib/activityLabel";
import Modal from "./Modal";
import { Field, inputClass } from "./form";

type Existing = {
  id: string;
  title: string;
  dueDate: string;
  ownerId: string;
  level: PermissionLevel;
};

type ActivityEntry = {
  id: string;
  field: KeyResultActivityField;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedBy: { id: string; name: string } | null;
};

type HistoryData = {
  entries: ActivityEntry[];
  /** When the project was created and by whom (createdBy is null for projects created before creators were tracked). */
  createdAt: string | null;
  createdBy: { id: string; name: string } | null;
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
   * set -- except while editing an existing project, where passing this
   * (alongside the current `objectiveId`) turns the Objective dropdown on
   * so the project can be moved to a different objective. */
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryData | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const userById = new Map(users.map((u) => [u.id, u]));

  async function toggleHistory() {
    if (historyOpen) {
      setHistoryOpen(false);
      return;
    }
    setHistoryOpen(true);
    if (history === null && existing) {
      setHistoryLoading(true);
      try {
        const res = await fetch(`/api/key-results/${existing.id}/activity`);
        setHistory(res.ok ? await res.json() : { entries: [], createdAt: null, createdBy: null });
      } catch {
        setHistory({ entries: [], createdAt: null, createdBy: null });
      } finally {
        setHistoryLoading(false);
      }
    }
  }

  // Resolved target objective: the fixed prop when scoped to one objective,
  // otherwise whichever the person picked from the new dropdown.
  // The Objective dropdown shows when no objective is fixed (Add Project on
  // the Projects page) or when editing an existing project that was given
  // the list of objectives it can move to.
  const canPick = !!objectives && (!objectiveId || !!existing);
  const effectiveObjectiveId = canPick ? selectedObjectiveId : (objectiveId ?? selectedObjectiveId);
  const effectiveObjectiveDueDate =
    canPick || !objectiveId
      ? (objectives?.find((o) => o.id === selectedObjectiveId)?.dueDate ?? null)
      : objectiveDueDate;
  const isMoving = !!existing && !!objectiveId && selectedObjectiveId !== objectiveId;

  function openEdit() {
    // Start from the project's current objective each time (it may have
    // been moved since this component mounted).
    setSelectedObjectiveId(objectiveId ?? objectives?.[0]?.id ?? "");
    setError(null);
    setOpen(true);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (effectiveObjectiveDueDate && dueDate && dueDate > effectiveObjectiveDueDate) {
      setError("A project's due date can't be after the objective's due date.");
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
      // Drop the cached history so it's re-fetched (and includes this
      // save) the next time the panel is opened.
      setHistory(null);
      setHistoryOpen(false);
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
          onClick={openEdit}
          aria-label="Edit project"
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
          Add Project
        </button>
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={existing ? "Edit project" : "Add project"}>
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          {canPick && objectives && (
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
              {isMoving && (
                <p className="mt-1 text-[11px] text-ink-tertiary">
                  Moving this project also moves all of its tasks to the new objective.
                </p>
              )}
            </Field>
          )}
          <Field label="Project">
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
            A project&rsquo;s status isn&rsquo;t set manually -- it&rsquo;s the worst status
            among its tasks (e.g. any task At Risk makes the project At Risk), and the
            objective&rsquo;s overall progress is the average of its projects&rsquo; statuses.
          </p>
          {existing && (
            <div className="rounded-lg border border-line">
              <button
                type="button"
                onClick={toggleHistory}
                className="flex w-full items-center justify-between px-3 py-2.5 text-[12.5px] font-semibold text-ink-secondary hover:text-ink"
              >
                <span>
                  History{history && history.entries.length > 0 ? ` (${history.entries.length})` : ""}
                </span>
                <span className="text-ink-tertiary">{historyOpen ? "▴" : "▾"}</span>
              </button>
              {historyOpen && (
                <div className="max-h-[220px] overflow-y-auto border-t border-line px-3 py-2.5">
                  {historyLoading && <p className="text-[12px] text-ink-tertiary">Loading…</p>}
                  {!historyLoading && history && history.entries.length === 0 && (
                    <p className="text-[12px] text-ink-tertiary">
                      No changes recorded yet -- title, due date, owner, and visibility edits will
                      show up here.
                    </p>
                  )}
                  {!historyLoading && history && history.entries.length > 0 && (
                    <ul className="flex flex-col gap-2.5">
                      {history.entries.map((h) => (
                        <li key={h.id} className="text-[12px] leading-relaxed text-ink-secondary">
                          <span className="font-semibold text-ink">{KEY_RESULT_ACTIVITY_FIELD_LABELS[h.field]}</span>
                          {": "}
                          {formatKeyResultActivityValue(h.field, h.oldValue, userById)}
                          {" → "}
                          {formatKeyResultActivityValue(h.field, h.newValue, userById)}
                          <div className="text-[11px] text-ink-tertiary">
                            {h.changedBy?.name ?? "Someone"} ·{" "}
                            {format(new Date(h.changedAt), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!historyLoading && history && history.createdAt && (
                    <div className="mt-2.5 border-t border-[#F2F4F7] pt-2.5 text-[12px] leading-relaxed text-ink-secondary">
                      <span className="font-semibold text-ink">Created</span>
                      <div className="text-[11px] text-ink-tertiary">
                        {history.createdBy ? `by ${history.createdBy.name}` : "creator not recorded"} ·{" "}
                        {format(new Date(history.createdAt), "MMM d, yyyy 'at' h:mm a")}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {error && <p className="text-[13px] text-status-offTrackText">{error}</p>}
          <button
            disabled={loading}
            className="mt-1 rounded-lg bg-accent py-2.5 text-[14px] font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {loading ? "Saving…" : existing ? "Save changes" : "Add project"}
          </button>
        </form>
      </Modal>
    </>
  );
}
