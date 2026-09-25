"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PermissionLevel } from "@/lib/db";
import { LEVEL_ORDER, LEVEL_META } from "@/lib/permissions";

/**
 * Admin-only "Level" dropdown on the Team page -- sets a person's own
 * visibility level (Senior Leadership / Manager / All), which
 * decides which objectives/key results/tasks they can see (see
 * src/lib/permissions.ts). Mirrors ManagerSelect.tsx exactly: PATCHes
 * /api/users/[id] as soon as a new level is picked, reverts and shows an
 * inline error on failure. Non-admins never see this component -- the
 * Team page falls back to a plain-text badge for them, since PATCH
 * /api/users/[id] is admin-gated for both managerId and level.
 */
export default function UserLevelSelect({
  userId,
  currentLevel,
}: {
  userId: string;
  currentLevel: PermissionLevel;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentLevel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const meta = LEVEL_META[value];

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as PermissionLevel;
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ level: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setValue(previous);
        setError(body.error ?? "Couldn't update level.");
      } else {
        router.refresh();
      }
    } catch {
      setValue(previous);
      setError("Couldn't update level.");
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
        className="cursor-pointer appearance-none rounded-full border-none px-2.5 py-1 text-[11.5px] font-semibold outline-none disabled:opacity-70"
        style={{ background: meta.bg, color: meta.text }}
      >
        {LEVEL_ORDER.map((l) => (
          <option key={l} value={l}>
            {LEVEL_META[l].label}
          </option>
        ))}
      </select>
      {error && <div className="mt-1 text-[11px] text-[#B42318]">{error}</div>}
    </div>
  );
}
