import Link from "next/link";
import { format, formatDistanceToNow } from "date-fns";
import { listRecentTaskActivity, listTasksWithActivityStatus, listUsers } from "@/lib/db";
import {
  formatActivityValue,
  ACTIVITY_FIELD_LABELS,
  activityFreshness,
  FRESHNESS_META,
} from "@/lib/activityLabel";
import { initials, colorForName } from "@/lib/avatar";
import StatusPill from "@/components/StatusPill";
import PersonFilter from "@/components/PersonFilter";

const ACTIVITY_LIMIT = 200;

/**
 * The org-wide movement log: every change to a task's status, due date,
 * sub-owner, details, or notes, newest first. Each row is written by
 * updateTask (src/lib/db.ts) whenever one of those five fields' final
 * value actually differs from what it was before the edit -- title,
 * owner, priority, and key-result reassignment are deliberately not
 * tracked here, matching exactly what was asked for.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams?: { person?: string };
}) {
  const [activity, tasks, allUsers] = await Promise.all([
    listRecentTaskActivity(ACTIVITY_LIMIT),
    listTasksWithActivityStatus(),
    listUsers(),
  ]);
  const users = allUsers.map((u) => ({ id: u.id, name: u.name }));
  const userById = new Map(allUsers.map((u) => [u.id, u]));

  const personFilter = searchParams?.person ?? "";

  // Most-recently-changed-first: recently changed (green) tasks lead, then
  // changed-but-not-recent (yellow) tasks, then never-changed (red) tasks
  // last. Since green vs. yellow is purely a function of how recent
  // lastChangedAt is, sorting by lastChangedAt descending produces exactly
  // this three-tier grouping on its own -- every green task sorts ahead of
  // every yellow task (both ordered most-recent-first within their tier),
  // and every never-changed task (lastChangedAt: null, treated as
  // -Infinity) sorts dead last, since nothing is smaller. The person filter
  // (when set) narrows this to tasks that person owns or is a delegated
  // sub-owner of, same "counts for both" convention as Home's myTasks
  // filter.
  const tasksFiltered = personFilter
    ? tasks.filter((t) => t.ownerId === personFilter || t.subOwnerId === personFilter)
    : tasks;
  const tasksByFreshness = [...tasksFiltered].sort((a, b) => {
    const aTime = a.lastChangedAt ? new Date(a.lastChangedAt).getTime() : -Infinity;
    const bTime = b.lastChangedAt ? new Date(b.lastChangedAt).getTime() : -Infinity;
    return bTime - aTime;
  });

  // The recent-changes feed has no task-owner info attached to each row
  // (see TaskActivityFull) -- the person it actually carries is whoever
  // MADE the change, so the same filter narrows this list to changes
  // attributed to that person instead.
  const activityFiltered = personFilter
    ? activity.filter((a) => a.changedById === personFilter)
    : activity;

  return (
    <>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-y-2 border-b border-line bg-white px-4 py-4 md:px-7 md:py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Activity</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {activityFiltered.length} change{activityFiltered.length === 1 ? "" : "s"} to status, due
            dates, sub-owners, details, and notes
            {!personFilter && activity.length === ACTIVITY_LIMIT ? ` (most recent ${ACTIVITY_LIMIT})` : ""}
          </p>
        </div>
        <PersonFilter users={users} current={personFilter} basePath="/activity" />
      </div>

      <div className="flex-grow overflow-y-auto p-4 md:p-7">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <h2 className="text-[15px] font-bold text-ink">All tasks</h2>
          <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-ink-tertiary">
            {(["green", "yellow", "red"] as const).map((key) => (
              <span key={key} className="flex items-center gap-1.5">
                <span
                  className="h-[8px] w-[8px] flex-shrink-0 rounded-full"
                  style={{ background: FRESHNESS_META[key].dot }}
                />
                {FRESHNESS_META[key].label}
              </span>
            ))}
          </div>
        </div>
        <div className="mb-7 overflow-hidden rounded-card border border-line bg-white">
          {tasksByFreshness.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-ink-tertiary">
              {personFilter ? "No tasks for this person." : "No tasks yet."}
            </div>
          ) : (
            <>
              <div className="hidden gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary md:grid md:grid-cols-[1.3fr_1.1fr_140px_120px_170px]">
                <span>TASK</span>
                <span>KEY RESULT</span>
                <span>OWNER</span>
                <span>STATUS</span>
                <span>LAST CHANGED</span>
              </div>
              {tasksByFreshness.map((t) => {
                const freshness = activityFreshness(t.lastChangedAt);
                const meta = FRESHNESS_META[freshness];
                return (
                  <Link
                    key={t.id}
                    href={t.objectiveId ? `/board/${t.objectiveId}?editTask=${t.id}` : "/activity"}
                    className="flex flex-col gap-1.5 border-t border-[#F2F4F7] px-5 py-3 hover:bg-surface-panel md:grid md:grid-cols-[1.3fr_1.1fr_140px_120px_170px] md:items-center md:gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-[8px] w-[8px] flex-shrink-0 rounded-full"
                        style={{ background: meta.dot }}
                        title={meta.label}
                      />
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium text-ink">{t.title}</div>
                        {t.objectiveTitle && (
                          <div className="truncate text-[11.5px] text-ink-tertiary">{t.objectiveTitle}</div>
                        )}
                      </div>
                    </div>
                    <span className="truncate text-[12.5px] text-ink-secondary">
                      <span className="font-semibold text-ink-tertiary md:hidden">Key result: </span>
                      {t.keyResultTitle || "—"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink-tertiary md:hidden">Owner: </span>
                      {t.owner ? (
                        <>
                          <div
                            className="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{ background: colorForName(t.owner.name) }}
                          >
                            {initials(t.owner.name)}
                          </div>
                          <span className="truncate text-[12.5px] text-[#344054]">{t.owner.name}</span>
                        </>
                      ) : (
                        <span className="text-[12.5px] text-ink-tertiary">Unassigned</span>
                      )}
                    </div>
                    <span>
                      <span className="font-semibold text-ink-tertiary md:hidden">Status: </span>
                      <StatusPill status={t.status} />
                    </span>
                    <span
                      className="inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                      style={{ background: meta.bg, color: meta.text }}
                    >
                      <span className="font-semibold md:hidden">Last changed: </span>
                      {t.lastChangedAt
                        ? formatDistanceToNow(new Date(t.lastChangedAt), { addSuffix: true })
                        : "Never changed"}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
        </div>

        <h2 className="mb-3 text-[15px] font-bold text-ink">Recent changes</h2>
        <div className="overflow-hidden rounded-card border border-line bg-white">
          {activityFiltered.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-ink-tertiary">
              {personFilter
                ? "No changes made by this person yet."
                : "No changes recorded yet. Editing a task\u2019s status, due date, sub-owner, details, or notes will show up here."}
            </div>
          ) : (
            <>
              <div className="hidden gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary md:grid md:grid-cols-[1.2fr_100px_1.6fr_140px_120px]">
                <span>TASK</span>
                <span>FIELD</span>
                <span>CHANGE</span>
                <span>BY</span>
                <span>WHEN</span>
              </div>
              {activityFiltered.map((a) => (
                <Link
                  key={a.id}
                  href={a.objectiveId ? `/board/${a.objectiveId}?editTask=${a.taskId}` : "/activity"}
                  className="flex flex-col gap-1.5 border-t border-[#F2F4F7] px-5 py-3 hover:bg-surface-panel md:grid md:grid-cols-[1.2fr_100px_1.6fr_140px_120px] md:items-center md:gap-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-medium text-ink">{a.taskTitle}</div>
                    {a.objectiveTitle && (
                      <div className="truncate text-[11.5px] text-ink-tertiary">{a.objectiveTitle}</div>
                    )}
                  </div>
                  <span className="text-[12.5px] font-semibold text-ink-secondary">
                    <span className="font-semibold text-ink-tertiary md:hidden">Field: </span>
                    {ACTIVITY_FIELD_LABELS[a.field]}
                  </span>
                  <span className="text-[13px] text-ink-secondary">
                    <span className="font-semibold text-ink-tertiary md:hidden">Change: </span>
                    {formatActivityValue(a.field, a.oldValue, userById)}
                    {" → "}
                    {formatActivityValue(a.field, a.newValue, userById)}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink-tertiary md:hidden">By: </span>
                    {a.changedBy ? (
                      <>
                        <div
                          className="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                          style={{ background: colorForName(a.changedBy.name) }}
                        >
                          {initials(a.changedBy.name)}
                        </div>
                        <span className="truncate text-[12.5px] text-[#344054]">{a.changedBy.name}</span>
                      </>
                    ) : (
                      <span className="text-[12.5px] text-ink-tertiary">Unknown</span>
                    )}
                  </div>
                  <span className="text-[12.5px] text-ink-tertiary">
                    <span className="font-semibold md:hidden">When: </span>
                    {format(new Date(a.changedAt), "MMM d, h:mm a")}
                  </span>
                </Link>
              ))}
            </>
          )}
        </div>
      </div>
    </>
  );
}
