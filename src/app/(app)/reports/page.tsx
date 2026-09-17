import Link from "next/link";
import { format } from "date-fns";
import { getObjectivesFull } from "@/lib/db";
import { objectiveProgress } from "@/lib/rollup";
import { STATUS_ORDER, STATUS_META, isOverdue } from "@/lib/status";
import { initials, colorForName } from "@/lib/avatar";

export default async function ReportsPage() {
  const objectives = await getObjectivesFull();
  const allTasks = objectives.flatMap((o) => o.keyResults.flatMap((kr) => kr.tasks));

  const statusCounts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = allTasks.filter((t) => t.status === s).length;
    return acc;
  }, {});

  const overdueTasks = allTasks
    .filter((t) => isOverdue(t.dueDate, t.status))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const objectiveRows = objectives.map((o) => ({
    id: o.id,
    title: o.title,
    progress: objectiveProgress(o.keyResults),
    keyResultCount: o.keyResults.length,
    taskCount: o.keyResults.reduce((sum, kr) => sum + kr.tasks.length, 0),
  }));

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-7 py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Reports</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {allTasks.length} tasks across {objectives.length} objective
            {objectives.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-7">
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {STATUS_ORDER.map((s) => (
            <div key={s} className="rounded-card border border-line bg-white p-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-ink-tertiary">
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: STATUS_META[s].dot }} />
                {STATUS_META[s].label.toUpperCase()}
              </div>
              <div className="text-[22px] font-bold text-ink">{statusCounts[s] ?? 0}</div>
            </div>
          ))}
        </div>

        <div className="mb-6 overflow-hidden rounded-card border border-line bg-white">
          <div className="border-b border-[#EEF0F3] px-5 py-3 text-[13px] font-bold text-ink">
            Objective progress
          </div>
          <div className="grid grid-cols-[1fr_100px_110px_110px] gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary">
            <span>OBJECTIVE</span>
            <span>PROGRESS</span>
            <span>KEY RESULTS</span>
            <span>TASKS</span>
          </div>
          {objectiveRows.map((o) => (
            <Link
              key={o.id}
              href={`/board/${o.id}`}
              className="grid grid-cols-[1fr_100px_110px_110px] items-center gap-3 border-t border-[#F2F4F7] px-5 py-3 hover:bg-surface-panel"
            >
              <span className="truncate text-[13.5px] font-medium text-ink">{o.title}</span>
              <span className="text-[13.5px] font-semibold text-ink">{o.progress}%</span>
              <span className="text-[13px] text-ink-secondary">{o.keyResultCount}</span>
              <span className="text-[13px] text-ink-secondary">{o.taskCount}</span>
            </Link>
          ))}
        </div>

        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="border-b border-[#EEF0F3] px-5 py-3 text-[13px] font-bold text-ink">
            Overdue tasks ({overdueTasks.length})
          </div>
          {overdueTasks.length === 0 ? (
            <div className="px-5 py-5 text-[13px] text-ink-tertiary">Nothing overdue. Nice.</div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_170px_110px] gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary">
                <span>TASK</span>
                <span>OWNER</span>
                <span>DUE DATE</span>
              </div>
              {overdueTasks.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[1fr_170px_110px] items-center gap-3 border-t border-[#F2F4F7] px-5 py-3"
                >
                  <span className="truncate text-[13.5px] font-medium text-ink">{t.title}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ background: colorForName(t.owner.name) }}
                    >
                      {initials(t.owner.name)}
                    </div>
                    <span className="truncate text-[13px] text-[#344054]">{t.owner.name}</span>
                  </div>
                  <div className="text-[13px] font-medium" style={{ color: "#B42318" }}>
                    {format(new Date(t.dueDate), "MMM d")}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
