import Link from "next/link";
import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getObjectivesFull } from "@/lib/db";
import { STATUS_META, isOverdue } from "@/lib/status";
import StatusSelect from "@/components/StatusSelect";

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const objectives = await getObjectivesFull();
  const myTasks = objectives
    .flatMap((o) =>
      o.keyResults.flatMap((kr) =>
        kr.tasks
          .filter((t) => t.ownerId === userId)
          .map((t) => ({
            ...t,
            objectiveId: o.id,
            objectiveTitle: o.title,
            keyResultTitle: kr.title,
          }))
      )
    )
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const openCount = myTasks.filter((t) => t.status !== "DONE").length;
  const overdueCount = myTasks.filter((t) => isOverdue(t.dueDate, t.status)).length;

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-7 py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">My Tasks</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {openCount} open{overdueCount > 0 ? ` · ${overdueCount} overdue` : ""}
          </p>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-7">
        {myTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-white py-20 text-center">
            <p className="font-display text-[16px] font-bold text-ink">No tasks assigned to you</p>
            <p className="max-w-sm text-[13px] text-ink-secondary">
              Tasks you own across every objective will show up here.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-card border border-line bg-white">
            <div className="grid grid-cols-[1fr_1fr_120px_130px] gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary">
              <span>TASK</span>
              <span>OBJECTIVE / KEY RESULT</span>
              <span>DUE DATE</span>
              <span>STATUS</span>
            </div>
            {myTasks.map((task) => {
              const overdue = isOverdue(task.dueDate, task.status);
              return (
                <div
                  key={task.id}
                  className="grid grid-cols-[1fr_1fr_120px_130px] items-center gap-3 border-t border-[#F2F4F7] px-5 py-3"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                      style={{ background: STATUS_META[task.status].dot }}
                    />
                    <span className="truncate text-[13.5px] font-medium text-ink">{task.title}</span>
                  </div>
                  <Link
                    href={`/board/${task.objectiveId}`}
                    className="min-w-0 truncate text-[13px] text-ink-secondary hover:text-accent"
                  >
                    {task.objectiveTitle}{" "}
                    <span className="text-ink-tertiary">/ {task.keyResultTitle}</span>
                  </Link>
                  <div
                    className="text-[13px] font-medium"
                    style={{ color: overdue ? "#B42318" : "#475467" }}
                  >
                    {format(new Date(task.dueDate), "MMM d")}
                    {overdue ? " · overdue" : ""}
                  </div>
                  <div>
                    <StatusSelect taskId={task.id} status={task.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
