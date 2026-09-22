import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getObjectiveFull, listUsers } from "@/lib/db";
import { keyResultProgress, objectiveProgress } from "@/lib/rollup";
import { STATUS_META, isOverdue } from "@/lib/status";
import { PRIORITY_META } from "@/lib/priority";
import { initials, colorForName } from "@/lib/avatar";
import StatusSelect from "@/components/StatusSelect";
import KeyResultStatusBadge from "@/components/KeyResultStatusBadge";
import DeleteTaskButton from "@/components/DeleteTaskButton";
import TaskModal from "@/components/TaskModal";
import KeyResultModal from "@/components/KeyResultModal";
import ObjectiveModal from "@/components/ObjectiveModal";
import DeleteObjectiveButton from "@/components/DeleteObjectiveButton";
import PersonFilter from "@/components/PersonFilter";

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: { objectiveId: string };
  searchParams?: { person?: string };
}) {
  const objective = await getObjectiveFull(params.objectiveId);
  if (!objective) notFound();

  const users = (await listUsers()).map((u) => ({ id: u.id, name: u.name }));
  const overallProgress = objectiveProgress(objective.keyResults);
  // Every key result stays offered in the reassign-to dropdowns below even
  // when a person filter is active -- it only hides key-result CARDS that
  // have nothing left to show, it never narrows what a task can be moved to.
  const allKeyResults = objective.keyResults.map((kr) => ({ id: kr.id, title: kr.title }));
  const totalTaskCount = objective.keyResults.reduce((sum, kr) => sum + kr.tasks.length, 0);

  const personFilter = searchParams?.person ?? "";
  const keyResultsToShow = personFilter
    ? objective.keyResults
        .map((kr) => ({
          ...kr,
          tasks: kr.tasks.filter((t) => t.ownerId === personFilter || t.subOwnerId === personFilter),
        }))
        .filter((kr) => kr.tasks.length > 0)
    : objective.keyResults;

  return (
    <>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-y-2 border-b border-line bg-white px-4 py-3 md:flex-nowrap md:px-7 md:py-[18px]">
        <div className="flex flex-wrap items-center gap-2 text-[14.5px]">
          <Link href="/objectives" className="text-ink-tertiary hover:text-ink-secondary">
            Objectives
          </Link>
          <span className="text-ink-tertiary">/</span>
          <span className="font-semibold text-ink">
            {objective.title}
            {objective.dueDate ? ` — Due ${format(new Date(objective.dueDate), "MMM d, yyyy")}` : ""}
          </span>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
            {overallProgress}% overall
          </span>
          <ObjectiveModal
            existing={{
              id: objective.id,
              title: objective.title,
              team: objective.team ?? "",
              dueDate: objective.dueDate ?? "",
            }}
          />
          <DeleteObjectiveButton
            objectiveId={objective.id}
            keyResultCount={objective.keyResults.length}
            taskCount={totalTaskCount}
            redirectTo="/objectives"
          />
        </div>
        <div className="flex items-center gap-2">
          <PersonFilter users={users} current={personFilter} basePath={`/board/${objective.id}`} />
          {allKeyResults.length > 0 && (
            <KeyResultModal objectiveId={objective.id} objectiveDueDate={objective.dueDate} users={users} />
          )}
          {allKeyResults.length > 0 && <TaskModal keyResults={allKeyResults} users={users} />}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 md:p-7">
        <div className="flex flex-col gap-5">
          {objective.keyResults.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line bg-white py-16 text-center">
              <p className="font-display text-[16px] font-bold text-ink">
                Add this objective&rsquo;s first key result
              </p>
              <p className="max-w-sm text-[13px] text-ink-secondary">
                Tasks live under a key result, and each key result&rsquo;s progress rolls up
                into &ldquo;{objective.title}&rdquo;&rsquo;s overall progress.
              </p>
              <KeyResultModal objectiveId={objective.id} objectiveDueDate={objective.dueDate} users={users} />
            </div>
          )}

          {objective.keyResults.length > 0 && keyResultsToShow.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-white py-16 text-center">
              <p className="font-display text-[16px] font-bold text-ink">No tasks for this person</p>
              <p className="max-w-sm text-[13px] text-ink-secondary">
                They aren&rsquo;t the owner or sub-owner of any task under this objective yet.
              </p>
            </div>
          )}

          {keyResultsToShow.map((kr) => {
            const progress = keyResultProgress(kr);
            const krOverdue = kr.dueDate ? isOverdue(kr.dueDate, kr.status) : false;
            return (
              <div key={kr.id} className="overflow-hidden rounded-card border border-line bg-white">
                <div className="flex flex-wrap items-center justify-between gap-y-2 border-b border-[#EEF0F3] px-5 py-4">
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
                        dueDate: kr.dueDate ?? "",
                        ownerId: kr.ownerId ?? "",
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-1.5 w-[70px] overflow-hidden rounded-full bg-[#EEF0F3] md:w-[120px]">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="min-w-[38px] text-right text-[14px] font-bold text-ink">
                      {progress}%
                    </span>
                    <KeyResultStatusBadge status={kr.status} />
                  </div>
                </div>

                <div className="hidden gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary md:grid md:grid-cols-[1fr_190px_120px_130px_74px]">
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
                      className="flex flex-col gap-2 border-t border-[#F2F4F7] px-5 py-3 md:grid md:grid-cols-[1fr_190px_120px_130px_74px] md:items-start md:gap-3"
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
                          {task.priority && (
                            <span
                              className="flex-shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-semibold"
                              style={{
                                background: PRIORITY_META[task.priority].bg,
                                color: PRIORITY_META[task.priority].text,
                              }}
                            >
                              {PRIORITY_META[task.priority].label}
                            </span>
                          )}
                        </div>
                        {task.subOwner && (
                          <div className="ml-4 text-[12px] leading-snug text-ink-tertiary">
                            Also delegated to {task.subOwner.name}
                          </div>
                        )}
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
                      <div className="flex items-center gap-2 md:pt-0.5">
                        <span className="font-semibold text-ink-tertiary md:hidden">Owner: </span>
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
                        className="text-[13px] font-medium md:pt-0.5"
                        style={{ color: overdue ? "#B42318" : "#475467" }}
                      >
                        <span className="font-semibold text-ink-tertiary md:hidden">Due: </span>
                        {format(new Date(task.dueDate), "MMM d")}
                        {overdue ? " · overdue" : ""}
                      </div>
                      <div className="md:pt-0.5">
                        <StatusSelect taskId={task.id} status={task.status} />
                      </div>
                      <div className="flex items-center gap-1 md:pt-0.5">
                        <TaskModal
                          keyResults={allKeyResults}
                          users={users}
                          existing={{
                            id: task.id,
                            title: task.title,
                            status: task.status,
                            dueDate: format(new Date(task.dueDate), "yyyy-MM-dd"),
                            ownerId: task.ownerId,
                            subOwnerId: task.subOwnerId ?? "",
                            priority: task.priority ?? "",
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
    </>
  );
}
