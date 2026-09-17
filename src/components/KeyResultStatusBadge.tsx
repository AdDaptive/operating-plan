import type { TaskStatus } from "@/lib/db";
import { STATUS_META } from "@/lib/status";

/**
 * Read-only status pill for a key result. Key results no longer have a
 * manually-set status -- it's derived from the worst status among the key
 * result's own tasks (see computeKeyResultStatus in lib/rollup.ts), so
 * this just displays it instead of offering a dropdown to change it.
 */
export default function KeyResultStatusBadge({ status }: { status: TaskStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className="whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
      style={{ background: meta.bg, color: meta.text }}
    >
      {meta.label}
    </span>
  );
}
