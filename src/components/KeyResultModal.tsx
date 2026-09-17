"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "./Modal";
import { Field, inputClass } from "./form";

type Existing = {
  id: string;
  title: string;
  unit: string;
  targetValue: number;
  currentValue: number;
};

export default function KeyResultModal({
  objectiveId,
  existing,
}: {
  objectiveId: string;
  existing?: Existing;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [unit, setUnit] = useState(existing?.unit ?? "%");
  const [targetValue, setTargetValue] = useState(existing?.targetValue ?? 100);
  const [currentValue, setCurrentValue] = useState(existing?.currentValue ?? 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const url = existing ? `/api/key-results/${existing.id}` : "/api/key-results";
    const method = existing ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        unit,
        targetValue: Number(targetValue),
        currentValue: Number(currentValue),
        objectiveId,
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
          <div className="grid grid-cols-3 gap-3">
            <Field label="Current">
              <input
                required
                type="number"
                value={currentValue}
                onChange={(e) => setCurrentValue(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Target">
              <input
                required
                type="number"
                value={targetValue}
                onChange={(e) => setTargetValue(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Unit">
              <input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className={inputClass}
                placeholder="%, $M, days"
              />
            </Field>
          </div>
          <p className="text-[11.5px] text-ink-tertiary">
            Progress rolls up automatically as current ÷ target — and the objective&rsquo;s
            overall progress is the average of all its key results.
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
