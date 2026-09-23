import Link from "next/link";
import { format } from "date-fns";
import { getObjectivesFull, listUsers } from "@/lib/db";
import { keyResultProgress } from "@/lib/rollup";
import { STATUS_META, isOverdue } from "@/lib/status";
import { PRIORITY_META } from "@/lib/priority";
import { initials, colorForName } from "@/lib/avatar";
import StatusSelect from "@/components/StatusSelect";
import KeyResultStatusBadge from "@/components/KeyResultStatusBadge";
import DeleteTaskButton from "@/components/DeleteTaskButton";
import TaskModal from "@/components/TaskModal";
import KeyResultModal from "@/components/KeyResultModal";
import PersonFilter from "@/components/PersonFilter";
import PriorityFilter from "@/components/PriorityFilter";
import KeyResultAccordion from "@/components/KeyResultAccordion";
import DeleteKeyResultButton from "@/components/DeleteKeyResultButton";
import CreateMeetingAgendaButton from "@/components/CreateMeetingAgendaButton";

/**
 * Every key result across every objective, each with the tasks that fall
 * under it -- the same key-result-card layout as an objective's board page
 * (src/app/(app)/board/[objectiveId]/page.tsx), just flattened across all
 * objectives instead of scoped to one. Replaces the old "My Tasks" page
 * (which only showed the signed-in user's own tasks) with an org-wide view
 * where every key result's owner is visible too.
 */
export default async function KeyResultsPage({
  searchParams,
}: {
  searchParams?: { person?: string; priority?: string };
}) {
  const [objectives, allUsers] = await Promise.all([getObjectivesFull(), listUsers()]);
  const users = allUsers.map((u) => ({ id: u.id, name: u.name }));

  // Filtering down to one person's tasks (owner or delegated sub-owner,
  // same "counts for both" convention as Home's myTasks filter), and/or
  // down to one priority level, happens here, before any of the
  // grouping/counting below -- the two filters AND together. A key
  // result with no tasks left after both are applied is dropped
  // entirely, and so is an objective left with no key results, so the
  // filtered page only shows what actually matches.
  const personFilter = searchParams?.person ?? "";
  const priorityFilter = searchParams?.priority ?? "";
  const objectivesFiltered = personFilter || priorityFilter
    ? objectives
        .map((o) => ({
          ...o,
          keyResults: o.keyResults
            .map((kr) => ({
              ...kr,
              tasks: kr.tasks.filter((t) => {
                const personMatch = !personFilter || t.ownerId === personFilter || t.subOwnerId === personFilter;
                const priorityMatch = !priorityFilter || t.priority === priorityFilter;
                return personMatch && priorityMatch;
              }),
            }))
            .filter((kr) => kr.tasks.length > 0),
        }))
        .filter((o) => o.keyResults.length > 0)
    : objectives;

  const objectivesWithKeyResults = objectivesFiltered.filter((o) => o.keyResults.length > 0);
  const totalKeyResults = objectivesFiltered.reduce((sum, o) => sum + o.keyResults.length, 0);
  // Flattened across every objective (unlike the board page's allKeyResults,
  // which is scoped to just one) -- the header's "New Task" button lets the
  // person pick which objective/key-result via the modal's own dropdown.
  const allKeyResultsFlat = objectives.flatMap((o) => o.keyResults.map((kr) => ({ id: kr.id, title: kr.title })));
  const allKeyResultsByObjectiveId = new Map(
    objectives.map((o) => [o.id, o.keyResults.map((kr) => ({ id: kr.id, title: kr.title }))])
  );

  return (
    <>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-y-2 border-b border-line bg-white px-4 py-4 md:px-7 md:py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Key Results</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {totalKeyResults} key result{totalKeyResults === 1 ? "" : "s"} across{" "}
            {objectivesWithKeyResults.length} objective{objectivesWithKeyResults.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PersonFilter
            users={users}
            current={personFilter}
            basePath="/key-results"
            extraParams={priorityFilter ? { priority: priorityFilter } : {}}
          />
          <PriorityFilter
            current={priorityFilter}
            basePath="/key-results"
            extraParams={personFilter ? { person: personFilter } : {}}
          />
          <CreateMeetingAgendaButton users={users} />
          {allKeyResultsFlat.length > 0 && <TaskModal keyResults={allKeyResultsFlat} users={users} />}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 md:p-7">
        {objectivesWithKeyResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-white py-20 text-center">
            <p className="font-display text-[16px] font-bold text-ink">
              {personFilter || priorityFilter ? "No matching tasks" : "No key results yet"}
            </p>
            <p className="max-w-sm text-[13px] text-ink-secondary">
              {personFilter || priorityFilter
                ? "No task matches this filter combination yet."
                : "Add a key result to an objective from its board page and it\u2019ll show up here."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {objectivesWithKeyResults.map((objective) => {
              const allKeyResults = allKeyResultsByObjectiveId.get(objective.id) ?? [];

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
                        <KeyResultAccordion
                          key={kr.id}
                          taskCount={kr.tasks.length}
                          header={
                            <>
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
                                <DeleteKeyResultButton keyResultId={kr.id} taskCount={kr.tasks.length} />
                              </div>
                              <div className="flex items-center gap-2.5">
                                <div className="h-1.5 w-[70px] overflow-hidden rounded-full bg-[#EEF0F3] md:w-[120px]">
                                  <div
                                    className="h-full rounded-full bg-accent"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                                <span className="min-w-[38px] text-right text-[14px] font-bold text-ink">
                                  {progress}%
                                </span>
                                <KeyResultStatusBadge status={kr.status} />
                              </div>
                            </>
                          }
                        >
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
                        </KeyResultAccordion>
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
