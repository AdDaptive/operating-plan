import { STATUS_META } from "@/lib/status";
import type { TaskStatus } from "@/lib/db";

export default function StatusPill({ status }: { status: TaskStatus }) {
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
