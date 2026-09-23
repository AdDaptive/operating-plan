"use client";

import { useRouter } from "next/navigation";

/**
 * A "filter by person" dropdown, backed by a `?person=<id>` query param on
 * the current page rather than client-held filter state -- the page itself
 * (a server component) reads that param and filters its data server-side,
 * so this component only needs to know where to navigate on change. Shared
 * by the Key Results page, an objective's board, and the Activity page.
 */
export default function PersonFilter({
  users,
  current,
  basePath,
  extraParams = {},
}: {
  users: { id: string; name: string }[];
  current: string;
  basePath: string;
  /** Other query params (e.g. an active priority filter) to preserve when this one changes. */
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(extraParams);
    if (e.target.value) params.set("person", e.target.value);
    const qs = params.toString();
    router.push(qs ? `${basePath}?${qs}` : basePath);
  }

  return (
    <select
      value={current}
      onChange={onChange}
      className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-ink-secondary"
      aria-label="Filter by person"
    >
      <option value="">Everyone</option>
      {sortedUsers.map((u) => (
        <option key={u.id} value={u.id}>
          {u.name}
        </option>
      ))}
    </select>
  );
}
