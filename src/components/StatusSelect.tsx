"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskStatus } from "@/lib/db";
import { STATUS_ORDER, STATUS_META } from "@/lib/status";

export default function StatusSelect({ taskId, status }: { taskId: string; status: TaskStatus }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [saving, setSaving] = useState(false);
  const meta = STATUS_META[value];

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    // "Archive" isn't a real status: it moves the task to the Archive page
    // (its status is kept, so restoring puts it back as it was).
    if (e.target.value === "ARCHIVE") {
      setSaving(true);
      await fetch("/api/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "task", id: taskId, action: "archive" }),
      });
      setSaving(false);
      router.refresh();
      return;
    }
    const next = e.target.value as TaskStatus;
    setValue(next);
    setSaving(true);
    await fetch(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={saving}
      className="cursor-pointer appearance-none rounded-full border-none px-2.5 py-1 text-[11.5px] font-semibold outline-none disabled:opacity-70"
      style={{ background: meta.bg, color: meta.text }}
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {STATUS_META[s].label}
        </option>
      ))}
      <option value="ARCHIVE">Archive</option>
    </select>
  );
}
