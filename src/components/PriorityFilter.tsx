"use client";

import { useRouter } from "next/navigation";
import { PRIORITY_ORDER, PRIORITY_META } from "@/lib/priority";

/**
 * A "filter by priority" dropdown for the Key Results page, same
 * query-param-backed pattern as PersonFilter (`?priority=<value>` on the
 * current page, read and applied server-side) -- the two filters compose
 * (AND together), each passing the other's current value through
 * `extraParams` so changing one never clears the other.
 */
export default function PriorityFilter({
  current,
  basePath,
  extraParams = {},
}: {
  current: string;
  basePath: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(extraParams);
    if (e.target.value) params.set("priority", e.target.value);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink-secondary"
      aria-label="Filter by priority"
    >
      <option value="">Any priority</option>
      {PRIORITY_ORDER.map((p) => (
        <option key={p} value={p}>
          {PRIORITY_META[p].label}
        </option>
      ))}
    </select>
  );
}
