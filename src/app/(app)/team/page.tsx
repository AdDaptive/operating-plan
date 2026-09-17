import { listUsers, getObjectivesFull } from "@/lib/db";
import { isOverdue } from "@/lib/status";
import { initials, colorForName } from "@/lib/avatar";
import RunDigestButton from "@/components/RunDigestButton";
import TeamMemberDigestActions from "@/components/TeamMemberDigestActions";

export default async function TeamPage() {
  const [users, objectives] = await Promise.all([listUsers(), getObjectivesFull()]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const allTasks = objectives.flatMap((o) => o.keyResults.flatMap((kr) => kr.tasks));

  const rows = users.map((u) => {
    const tasks = allTasks.filter((t) => t.ownerId === u.id);
    const openTasks = tasks.filter((t) => t.status !== "DONE").length;
    const overdueTasks = tasks.filter((t) => isOverdue(t.dueDate, t.status)).length;
    const manager = u.managerId ? userById.get(u.managerId) : undefined;
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      managerName: manager?.name ?? null,
      totalTasks: tasks.length,
      openTasks,
      overdueTasks,
    };
  });

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-7 py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Team</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {rows.length} {rows.length === 1 ? "person" : "people"}
          </p>
        </div>
        <RunDigestButton />
      </div>

      <div className="flex-grow overflow-y-auto p-7">
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="grid grid-cols-[1fr_1fr_100px_100px_90px_210px] gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary">
            <span>PERSON</span>
            <span>REPORTS TO</span>
            <span>OPEN TASKS</span>
            <span>OVERDUE</span>
            <span>TOTAL</span>
            <span>DAILY DIGEST</span>
          </div>
          {rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_1fr_100px_100px_90px_210px] items-center gap-3 border-t border-[#F2F4F7] px-5 py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-white"
                  style={{ background: colorForName(r.name) }}
                >
                  {initials(r.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13.5px] font-semibold text-ink">{r.name}</div>
                  <div className="truncate text-[11.5px] text-ink-tertiary">{r.email}</div>
                </div>
              </div>
              <div className="truncate text-[13px] text-ink-secondary">{r.managerName ?? "—"}</div>
              <div className="text-[13.5px] font-semibold text-ink">{r.openTasks}</div>
              <div
                className="text-[13.5px] font-semibold"
                style={{ color: r.overdueTasks > 0 ? "#B42318" : "#475467" }}
              >
                {r.overdueTasks}
              </div>
              <div className="text-[13.5px] text-ink-secondary">{r.totalTasks}</div>
              <div>
                <TeamMemberDigestActions userId={r.id} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
