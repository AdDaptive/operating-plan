import Link from "next/link";
import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getObjectivesFull, listUsers } from "@/lib/db";
import { bucketTasks, isTeamFlag } from "@/lib/taskBuckets";
import { keyResultProgress } from "@/lib/rollup";
import { STATUS_META, isOverdue } from "@/lib/status";
import { initials, colorForName } from "@/lib/avatar";
import StatusSelect from "@/components/StatusSelect";
import KeyResultStatusBadge from "@/components/KeyResultStatusBadge";
import TeamMemberDigestActions from "@/components/TeamMemberDigestActions";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The personal landing page: every task you own, sorted by due date
 * (soonest first), plus the key results you own and (if you manage
 * anyone) what your team needs attention on. src/lib/taskBuckets.ts is
 * shared with src/lib/digest.ts, so "needs attention" (used for the
 * header's task count, and for red/flagged styling) means the same thing
 * here as it does in the digest -- but unlike the digest's own
 * attention-only framing, Home always shows the full list, in date order,
 * not grouped by bucket. Objectives/Key Results/Reports/Team stay the
 * org-wide browsing views; this is the "what's on my plate" view that
 * moved here after My Tasks became the org-wide Key Results tab.
 */
export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [objectives, users] = await Promise.all([getObjectivesFull(), listUsers()]);
  const me = users.find((u) => u.id === userId);
  const firstName = (me?.name ?? session?.user?.name ?? "there").split(" ")[0];

  const allTasks = objectives.flatMap((o) =>
    o.keyResults.flatMap((kr) =>
      kr.tasks
        .filter((t) => t.status !== "DONE")
        .map((t) => ({
          ...t,
          objectiveId: o.id,
          objectiveTitle: o.title,
          keyResultTitle: kr.title,
        }))
    )
  );

  const myTasks = allTasks
    .filter((t) => t.ownerId === userId)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const bucket = bucketTasks(myTasks);
  // Header copy still reads as an urgency signal -- only count the
  // attention-needing buckets, not the full list below.
  const attentionCount =
    bucket.overdue.length + bucket.dueToday.length + bucket.dueSoon.length + bucket.flagged.length;
  // The "Your tasks" table shows every task the person owns, sorted purely
  // by due date (soonest first) -- myTasks is already sorted that way
  // above, so no bucket-grouping here. Grouping by bucket first (attention
  // tasks, then everything else) reads out of date order once a task,
  // e.g., a flagged one due next month, sorts ahead of an on-track task
  // due next week; a plain due-date sort avoids that.
  const myVisibleTasks = myTasks;

  const myKeyResults = objectives.flatMap((o) =>
    o.keyResults
      .filter((kr) => kr.ownerId === userId)
      .map((kr) => ({ ...kr, objectiveId: o.id, objectiveTitle: o.title }))
  );

  const reportIds = new Set(users.filter((u) => u.managerId === userId).map((u) => u.id));
  const teamAttentionTasks = reportIds.size
    ? allTasks.filter((t) => reportIds.has(t.ownerId) && isTeamFlag(t)).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    : [];

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-7 py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">
            {greeting()}, {firstName}
          </h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {attentionCount === 0
              ? "You're all caught up — nothing overdue, due soon, or flagged."
              : `${attentionCount} task${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} your attention.`}
          </p>
        </div>
        {userId && <TeamMemberDigestActions userId={userId} />}
      </div>

      <div className="flex-grow overflow-y-auto p-7">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] font-bold tracking-wide text-ink-tertiary">YOUR TASKS</h2>
            {myVisibleTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line bg-white py-10 text-center">
                <p className="text-[13.5px] font-semibold text-ink">No open tasks</p>
                <p className="text-[12.5px] text-ink-tertiary">
                  Tasks you own will show up here, attention-needing ones first.
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
                {myVisibleTasks.map((task) => {
                  const overdue = isOverdue(task.dueDate, task.status);
                  return (
                    <div
                      key={task.id}
                      className="grid grid-cols-[1fr_1fr_120px_130px] items-start gap-3 border-t border-[#F2F4F7] px-5 py-3"
                    >
                      <div className="flex min-w-0 flex-col gap-1 pt-0.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="h-[7px] w-[7px] flex-shrink-0 rounded-full"
                            style={{ background: STATUS_META[task.status].dot }}
                          />
                          <span className="truncate text-[13.5px] font-medium text-ink">{task.title}</span>
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
                      <Link
                        href={`/board/${task.objectiveId}`}
                        className="min-w-0 truncate pt-0.5 text-[13px] text-ink-secondary hover:text-accent"
                      >
                        {task.objectiveTitle}{" "}
                        <span className="text-ink-tertiary">/ {task.keyResultTitle}</span>
                      </Link>
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-[13px] font-bold tracking-wide text-ink-tertiary">YOUR KEY RESULTS</h2>
            {myKeyResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line bg-white py-10 text-center">
                <p className="text-[13.5px] font-semibold text-ink">No key results assigned to you</p>
                <p className="text-[12.5px] text-ink-tertiary">
                  Key results you own will show up here — see any objective&rsquo;s board to set an owner.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-card border border-line bg-white">
                {myKeyResults.map((kr) => {
                  const progress = keyResultProgress(kr);
                  const krOverdue = kr.dueDate ? isOverdue(kr.dueDate, kr.status) : false;
                  return (
                    <Link
                      key={kr.id}
                      href={`/board/${kr.objectiveId}`}
                      className="flex items-center justify-between gap-3 border-t border-[#F2F4F7] px-5 py-3 first:border-t-0 hover:bg-surface-panel"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-semibold text-ink">{kr.title}</div>
                        <div className="mt-0.5 truncate text-[12px] text-ink-tertiary">
                          {kr.objectiveTitle}
                          {kr.dueDate && (
                            <span style={{ color: krOverdue ? "#B42318" : undefined }}>
                              {" "}
                              · Due {format(new Date(kr.dueDate), "MMM d, yyyy")}
                              {krOverdue ? " · overdue" : ""}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2.5">
                        <span className="text-[13px] font-bold text-ink">{progress}%</span>
                        <KeyResultStatusBadge status={kr.status} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {reportIds.size > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[13px] font-bold tracking-wide text-ink-tertiary">YOUR TEAM</h2>
              {teamAttentionTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-1 rounded-card border border-dashed border-line bg-white py-10 text-center">
                  <p className="text-[13.5px] font-semibold text-ink">Your team is on track</p>
                  <p className="text-[12.5px] text-ink-tertiary">
                    Overdue or flagged tasks belonging to your direct reports will show up here.
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
                  {teamAttentionTasks.map((task) => {
                    const overdue = isOverdue(task.dueDate, task.status);
                    return (
                      <div
                        key={task.id}
                        className="grid grid-cols-[1fr_1fr_120px_130px] items-center gap-3 border-t border-[#F2F4F7] px-5 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div
                            className="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                            style={{ background: colorForName(task.owner.name) }}
                          >
                            {initials(task.owner.name)}
                          </div>
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
                        <span
                          className="w-fit whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-semibold"
                          style={{
                            background: STATUS_META[task.status].bg,
                            color: STATUS_META[task.status].text,
                          }}
                        >
                          {STATUS_META[task.status].label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </>
  );
}
