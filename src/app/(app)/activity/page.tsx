import Link from "next/link";
import { format } from "date-fns";
import { listRecentTaskActivity, listUsers } from "@/lib/db";
import { formatActivityValue, ACTIVITY_FIELD_LABELS } from "@/lib/activityLabel";
import { initials, colorForName } from "@/lib/avatar";

const ACTIVITY_LIMIT = 200;

/**
 * The org-wide movement log: every change to a task's status, due date,
 * sub-owner, details, or notes, newest first. Each row is written by
 * updateTask (src/lib/db.ts) whenever one of those five fields' final
 * value actually differs from what it was before the edit -- title,
 * owner, priority, and key-result reassignment are deliberately not
 * tracked here, matching exactly what was asked for.
 */
export default async function ActivityPage() {
  const [activity, users] = await Promise.all([listRecentTaskActivity(ACTIVITY_LIMIT), listUsers()]);
  const userById = new Map(users.map((u) => [u.id, u]));

  return (
    <>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-y-2 border-b border-line bg-white px-4 py-4 md:px-7 md:py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Activity</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {activity.length} change{activity.length === 1 ? "" : "s"} to status, due dates,
            sub-owners, details, and notes
            {activity.length === ACTIVITY_LIMIT ? ` (most recent ${ACTIVITY_LIMIT})` : ""}
          </p>
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 md:p-7">
        <div className="overflow-hidden rounded-card border border-line bg-white">
          {activity.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-ink-tertiary">
              No changes recorded yet. Editing a task&rsquo;s status, due date, sub-owner,
              details, or notes will show up here.
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
              {activity.map((a) => (
                <Link
                  key={a.id}
                  href={a.objectiveId ? `/board/${a.objectiveId}` : "/activity"}
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
