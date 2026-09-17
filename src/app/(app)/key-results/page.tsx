import Link from "next/link";
import { format } from "date-fns";
import { getObjectivesFull, listUsers } from "@/lib/db";
import { keyResultProgress } from "@/lib/rollup";
import { STATUS_META, isOverdue } from "@/lib/status";
import { initials, colorForName } from "@/lib/avatar";
import StatusSelect from "@/components/StatusSelect";
import KeyResultStatusSelect from "@/components/KeyResultStatusSelect";
import DeleteTaskButton from "@/components/DeleteTaskButton";
import TaskModal from "@/components/TaskModal";
import KeyResultModal from "@/components/KeyResultModal";

/**
 * Every key result across every objective, each with the tasks that fall
 * under it -- the same key-result-card layout as an objective's board page
 * (src/app/(app)/board/[objectiveId]/page.tsx), just flattened across all
 * objectives instead of scoped to one. Replaces the old "My Tasks" page
 * (which only showed the signed-in user's own tasks) with an org-wide view
 * where every key result's owner is visible too.
 */
export default async function KeyResultsPage() {
  const [objectives, allUsers] = await Promise.all([getObjectivesFull(), listUsers()]);
  const users = allUsers.map((u) => ({ id: u.id, name: u.name }));

  const objectivesWithKeyResults = objectives.filter((o) => o.keyResults.length > 0);
  const totalKeyResults = objectives.reduce((sum, o) => sum + o.keyResults.length, 0);

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-7 py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Key Results</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {totalKeyResults} key result{totalKeyResults === 1 ? "" : "s"} across{" "}
            {objectivesWithKeyResults.length} objective{objectivesWithKeyResults.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-7">
        {objectivesWithKeyResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-white py-20 text-center">
            <p className="font-display text-[16px] font-bold text-ink">No key results yet</p>
            <p className="max-w-sm text-[13px] text-ink-secondary">
              Add a key result to an objective from its board page and it&rsquo;ll show up here.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {objectivesWithKeyResults.map((objective) => {
              const allKeyResults = objective.keyResults.map((kr) => ({ id: kr.id, title: kr.title }));

              return (
                <div key={objective.id} className="flex flex-col gap-3">
                  <Link
                    href={`/board/${objective.id}`}
                    className="flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ink-secondary hover:text-accent"
                  >
                    {objective.title}
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7"></path>
                      <path d="M7 7h10v10"></path>
                    </svg>
                  </Link>

                  <div className="flex flex-col gap-5">
                    {objective.keyResults.map((kr) => {
                      const progress = keyResultProgress(kr);
                      const krOverdue = kr.dueDate ? isOverdue(kr.dueDate, kr.status) : false;
                      return (
                        <div key={kr.id} className="overflow-hidden rounded-card border border-line bg-white">
                          <div className="flex items-center justify-between border-b border-[#EEF0F3] px-5 py-4">
                            <div className="flex items-start gap-2">
                              <div>
                                <div className="mb-1 text-[10px] font-bold tracking-wide text-ink-tertiary">
                                  KEY RESULT
                                </div>
                                <div className="text-[15px] font-bold text-ink">{kr.title}</div>
                                <div className="mt-1 flex items-center gap-2.5">
                                  {kr.owner && (
                                    <div className="flex items-center gap-1.5">
                                      <div
                                        className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                                        style={{ background: colorForName(kr.owner.name) }}
                                      >
                                        {initials(kr.owner.name)}
                                      </div>
                                      <span className="text-[12px] text-ink-secondary">{kr.owner.name}</span>
                                    </div>
                                  )}
                                  {kr.dueDate && (
                                    <span
                                      className="text-[12px]"
                                      style={{ color: krOverdue ? "#B42318" : "var(--ink-secondary, #475467)" }}
                                    >
                                      Due {format(new Date(kr.dueDate), "MMM d, yyyy")}
                                      {krOverdue ? " · overdue" : ""}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <KeyResultModal
                                objectiveId={objective.id}
                                objectiveDueDate={objective.dueDate}
                                users={users}
                                existing={{
                                  id: kr.id,
                                  title: kr.title,
                                  status: kr.status,
                                  dueDate: kr.dueDate ?? "",
                                  ownerId: kr.ownerId ?? "",
                                }}
                              />
                            </div>
                            <div className="flex items-center gap-2.5">
                              <div className="h-1.5 w-[120px] overflow-hidden rounded-full bg-[#EEF0F3]">
                                <div
                                  className="h-full rounded-full bg-accent"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="min-w-[38px] text-right text-[14px] font-bold text-ink">
                                {progress}%
                              </span>
                              <KeyResultStatusSelect keyResultId={kr.id} status={kr.status} />
                            </div>
                          </div>

                          <div className="grid grid-cols-[1fr_190px_120px_130px_74px] gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary">
                            <span>TASK</span>
                            <span>OWNER</span>
                            <span>DUE DATE</span>
                            <span>STATUS</span>
                            <span></span>
                          </div>

                          {kr.tasks.length === 0 && (
                            <div className="px-5 py-5 text-[13px] text-ink-tertiary">
                              No tasks yet under this key result.
                            </div>
                          )}

                          {kr.tasks.map((task) => {
                            const overdue = isOverdue(task.dueDate, task.status);
                            return (
                              <div
                                key={task.id}
                                className="grid grid-cols-[1fr_190px_120px_130px_74px] items-start gap-3 border-t border-[#F2F4F7] px-5 py-3"
                              >
                                <div className="flex min-w-0 flex-col gap-1 pt-0.5">
                                  <div className="flex min-w-0 items-center gap-2.5">
                                    <span
                                      className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                                      style={{ background: STATUS_META[task.status].dot }}
                                    />
                                    <span className="truncate text-[13.5px] font-medium text-ink">
                                      {task.title}
                                    </span>
                                  </div>
                                  {task.description && (
                                    <div className="ml-4 text-[12px] leading-snug text-ink-tertiary">
                                      {task.description}
                                    </div>
                                  )}
                                  {task.notes && (
                                    <div className="ml-4 text-[12px] italic leading-snug text-ink-secondary">
                                      Notes: {task.notes}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 pt-0.5">
                                  <div
                                    className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                                    style={{ background: colorForName(task.owner.name) }}
                                  >
                                    {initials(task.owner.name)}
                                  </div>
                                  <span className="truncate text-[13px] text-[#344054]">
                                    {task.owner.name}
                                  </span>
                                </div>
                                <div
                                  className="pt-0.5 text-[13px] font-medium"
                                  style={{ color: overdue ? "#B42318" : "#475467" }}
                                >
                                  {format(new Date(task.dueDate), "MMM d")}
                                  {overdue ? " · overdue" : ""}
                                </div>
                                <div className="pt-0.5">
                                  <StatusSelect taskId={task.id} status={task.status} />
                                </div>
                                <div className="flex items-center gap-1 pt-0.5">
                                  <TaskModal
                                    keyResults={allKeyResults}
                                    users={users}
                                    existing={{
                                      id: task.id,
                                      title: task.title,
                                      status: task.status,
                                      dueDate: format(new Date(task.dueDate), "yyyy-MM-dd"),
                                      ownerId: task.ownerId,
                                      keyResultId: task.keyResultId,
                                      description: task.description ?? "",
                                      notes: task.notes ?? "",
                                    }}
                                  />
                                  <DeleteTaskButton taskId={task.id} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
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
