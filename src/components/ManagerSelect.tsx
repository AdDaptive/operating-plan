"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin-only "Reports to" dropdown on the Team page -- the one place a
 * person's managerId can be changed after their account is created (it
 * could previously only be set once, at invite time). Mirrors
 * StatusSelect.tsx's inline-select-that-saves-on-change pattern: no
 * separate save button, it PATCHes as soon as a new manager is picked.
 * Non-admins never see this component at all -- the Team page falls back
 * to plain text for them, since PATCH /api/users/[id] is admin-gated.
 */
export default function ManagerSelect({
  userId,
  currentManagerId,
  options,
}: {
  userId: string;
  currentManagerId: string | null;
  options: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentManagerId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A person can't be their own manager -- drop themselves from the list
  // rather than let the option exist and rely on the API to reject it.
  const selectable = options.filter((u) => u.id !== userId);

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value;
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId: next || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setValue(previous);
        setError(body.error ?? "Couldn't update manager.");
      } else {
        router.refresh();
      }
    } catch {
      setValue(previous);
      setError("Couldn't update manager.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-0">
      <select
        value={value}
        onChange={onChange}
        disabled={saving}
        className="w-full max-w-[180px] cursor-pointer rounded-md border border-line bg-white px-2 py-1 text-[13px] text-ink-secondary outline-none disabled:opacity-70"
      >
        <option value="">— None —</option>
        {selectable.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
      {error && <div className="mt-1 text-[11px] text-[#B42318]">{error}</div>}
    </div>
  );
}
