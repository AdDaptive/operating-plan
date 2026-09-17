"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@/lib/db";
import Modal from "./Modal";
import { Field, inputClass } from "./form";
import { STATUS_ORDER, STATUS_META } from "@/lib/status";

type Existing = {
  id: string;
  title: string;
  status: TaskStatus;
  dueDate: string;
  ownerId: string;
  keyResultId: string;
  description: string;
  notes: string;
};

export default function TaskModal({
  keyResults,
  users,
  existing,
}: {
  keyResults: { id: string; title: string }[];
  users: { id: string; name: string }[];
  existing?: Existing;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [status, setStatus] = useState<TaskStatus>(existing?.status ?? "NOT_STARTED");
  const [dueDate, setDueDate] = useState(existing?.dueDate ?? "");
  const [ownerId, setOwnerId] = useState(existing?.ownerId ?? users[0]?.id ?? "");
  const [keyResultId, setKeyResultId] = useState(existing?.keyResultId ?? keyResults[0]?.id ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        keyResultId,
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
      <Modal open={open} onClose={() => setOpen(false)} title={existing ? "Edit task" : "New task"}>
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
