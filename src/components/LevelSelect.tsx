"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PermissionLevel } from "@/lib/db";
import { LEVEL_ORDER, LEVEL_META } from "@/lib/permissions";

/**
 * Inline "who can see this" dropdown for an objective, key result, or
 * task -- mirrors StatusSelect.tsx's save-on-change pattern exactly (no
 * separate save button, PATCHes the instant a new level is picked). Open
 * to anyone signed in, same as every other field on these three has
 * always been (title, due date, owner, status, ...) -- unlike a user
 * account's own level (Team page), which is admin-only, see
 * UserLevelSelect.tsx.
 */
export default function LevelSelect({ endpoint, level }: { endpoint: string; level: PermissionLevel }) {
  const router = useRouter();
  const [value, setValue] = useState(level);
  const [saving, setSaving] = useState(false);
  const meta = LEVEL_META[value];

  async function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as PermissionLevel;
    setValue(next);
    setSaving(true);
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: next }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <select
      value={value}
      onChange={onChange}
      disabled={saving}
      title="Who can see this"
      className="cursor-pointer appearance-none rounded-full border-none px-2.5 py-1 text-[11px] font-semibold outline-none disabled:opacity-70"
      style={{ background: meta.bg, color: meta.text }}
    >
      {LEVEL_ORDER.map((l) => (
        <option key={l} value={l}>
          {LEVEL_META[l].label}
        </option>
      ))}
    </select>
  );
}
