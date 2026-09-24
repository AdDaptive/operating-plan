"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import type { TaskStatus, TaskActivityField, PermissionLevel } from "@/lib/db";
import Modal from "./Modal";
import { Field, inputClass } from "./form";
import { STATUS_ORDER, STATUS_META } from "@/lib/status";
import { PRIORITY_ORDER, PRIORITY_META } from "@/lib/priority";
import { LEVEL_ORDER, LEVEL_META } from "@/lib/permissions";
import { formatActivityValue, ACTIVITY_FIELD_LABELS } from "@/lib/activityLabel";

type Existing = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
  ownerId: string;
  subOwnerId: string;
  priority: string;
  keyResultId: string;
  level: PermissionLevel;
  description: string;
  notes: string;
};

type ActivityEntry = {
  id: string;
  field: TaskActivityField;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  changedBy: { id: string; name: string } | null;
};

export default function TaskModal({
  keyResults,
  users,
  existing,
  autoOpen = false,
}: {
  keyResults: { id: string; title: string }[];
  users: { id: string; name: string }[];
  existing?: Existing;
  // Opens the modal immediately on mount -- used when linking in from a
  // page (e.g. Activity) that wants to land directly in edit mode for one
  // specific task, via a `?editTask=<id>` query param the caller reads and
  // matches against `existing.id`. The param is stripped from the URL as
  // soon as the modal closes (see closeModal below), so navigating back or
  // refreshing afterward doesn't keep reopening it.
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(autoOpen);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "NOT_STARTED");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? users[0]?.id ?? "");
  const [subOwnerId, setSubOwnerId] = useState(existing?.subOwnerId ?? "");
  const [priority, setPriority] = useState(existing?.priority ?? "");
  const [level, setLevel] = useState<PermissionLevel>(existing?.level ?? "EMPLOYEE");
  const [keyResultId, setKeyResultId] = useState(existing?.keyResultId ?? keyResults[0]?.id ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ActivityEntry[] | null>(null);
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
      const res = await fetch(`/api/tasks/${existing.id}/activity`);
      setHistory(res.ok ? await res.json() : []);
      setHistoryLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const url = existing ? `/api/tasks/${existing.id}` : "/api/tasks";
    const method = existing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        status,
        dueDate,
        ownerId,
        subOwnerId: subOwnerId || null,
        priority: priority || null,
        keyResultId,
        level,
        description: description || null,
        notes: notes || null,
      }),
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

  function closeModal() {
    setOpen(false);
    if (autoOpen) {
      // Drop ?editTask=... from the URL so a refresh or back-navigation
      // doesn't reopen this same task's modal again.
      const url = new URL(window.location.href);
      url.searchParams.delete("editTask");
      router.replace(`${url.pathname}${url.search}`);
    }
  }

  return (
    <>
      {existing ? (
        <button
          onClick={() => setOpen(true)}
          aria-label="Edit task"
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
          New Task
        </button>
      )}
      <Modal open={open} onClose={closeModal} title={existing ? "Edit task" : "New task"}>
        <form onSubmit={onSubmit} className="flex flex-col gap-3.5">
          <Field label="Task">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="e.g. Renew Trade Desk API contract"
            />
          </Field>
          <Field label="Key result">
            <select
              required
              value={keyResultId}
              onChange={(e) => setKeyResultId(e.target.value)}
              className={inputClass}
            >
              {keyResults.map((kr) => (
                <option key={kr.id} value={kr.id}>
                  {kr.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Owner">
              <select
                required
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className={inputClass}
              >
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
                onChange={(e) => setDueDate(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sub-owner">
              <select
                value={subOwnerId}
                onChange={(e) => setSubOwnerId(e.target.value)}
                className={inputClass}
              >
                <option value="">— None —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass}
              >
                <option value="">— None —</option>
                {PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Status">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className={inputClass}
            >
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </Field>
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
          <Field label="Details">
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="What this task actually involves"
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={inputClass}
              placeholder="Status updates for yourself or whoever's watching this task"
            />
          </Field>
          {existing && (
            <div className="rounded-lg border border-line">
              <button
                type="button"
                onClick={toggleHistory}
                className="flex w-full items-center justify-between px-3 py-2.5 text-[12.5px] font-semibold text-ink-secondary hover:text-ink"
              >
                <span>
                  History{history && history.length > 0 ? ` (${history.length})` : ""}
                </span>
                <span className="text-ink-tertiary">{historyOpen ? "▴" : "▾"}</span>
              </button>
              {historyOpen && (
                <div className="max-h-[220px] overflow-y-auto border-t border-line px-3 py-2.5">
                  {historyLoading && <p className="text-[12px] text-ink-tertiary">Loading…</p>}
                  {!historyLoading && history && history.length === 0 && (
                    <p className="text-[12px] text-ink-tertiary">
                      No changes recorded yet -- status, due date, sub-owner, details, and notes
                      edits will show up here.
                    </p>
                  )}
                  {!historyLoading && history && history.length > 0 && (
                    <ul className="flex flex-col gap-2.5">
                      {history.map((h) => (
                        <li key={h.id} className="text-[12px] leading-relaxed text-ink-secondary">
                          <span className="font-semibold text-ink">{ACTIVITY_FIELD_LABELS[h.field]}</span>
                          {": "}
                          {formatActivityValue(h.field, h.oldValue, userById)}
                          {" → "}
                          {formatActivityValue(h.field, h.newValue, userById)}
                          <div className="text-[11px] text-ink-tertiary">
                            {h.changedBy?.name ?? "Someone"} ·{" "}
                            {format(new Date(h.changedAt), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        </li>
                      ))}
                    </ul>
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
            {loading ? "Saving…" : existing ? "Save changes" : "Create task"}
          </button>
        </form>
      </Modal>
    </>
  );
}
