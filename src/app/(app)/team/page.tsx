import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers, getObjectivesFull, getUserById } from "@/lib/db";
import { isOverdue } from "@/lib/status";
import { initials, colorForName } from "@/lib/avatar";
import RunDigestButton from "@/components/RunDigestButton";
import TeamMemberDigestActions from "@/components/TeamMemberDigestActions";
import InviteUserModal from "@/components/InviteUserModal";
import ResendInviteButton from "@/components/ResendInviteButton";

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;

  const [users, objectives, currentUser] = await Promise.all([
    listUsers(),
    getObjectivesFull(),
    sessionUserId ? getUserById(sessionUserId) : Promise.resolve(undefined),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  const allTasks = objectives.flatMap((o) => o.keyResults.flatMap((kr) => kr.tasks));
  const isAdmin = currentUser?.isAdmin ?? false;

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
      isAdmin: u.isAdmin,
      // No passwordHash yet means the invite hasn't been claimed --
      // see createInvitedUser/setUserPassword in src/lib/db.ts.
      pending: !u.passwordHash,
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
        <div className="flex items-center gap-2.5">
          <RunDigestButton />
          {isAdmin && (
            <InviteUserModal users={users.map((u) => ({ id: u.id, name: u.name }))} />
          )}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-7">
        {!isAdmin && (
          <p className="mb-4 text-[12.5px] text-ink-tertiary">
            Accounts are created by an admin now — ask one to invite anyone who&rsquo;s missing.
          </p>
        )}
        <div className="overflow-hidden rounded-card border border-line bg-white">
          <div className="grid grid-cols-[1.3fr_1fr_100px_100px_90px_210px] gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary">
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
              className="grid grid-cols-[1.3fr_1fr_100px_100px_90px_210px] items-center gap-3 border-t border-[#F2F4F7] px-5 py-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full text-[10.5px] font-bold text-white"
                  style={{ background: colorForName(r.name) }}
                >
                  {initials(r.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13.5px] font-semibold text-ink">{r.name}</span>
                    {r.isAdmin && (
                      <span className="flex-shrink-0 rounded-full bg-[#EEF4FF] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#3538CD]">
                        Admin
                      </span>
                    )}
                    {r.pending && (
                      <span className="flex-shrink-0 rounded-full bg-[#FFF6ED] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-[#B93815]">
                        Pending
                      </span>
                    )}
                  </div>
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
                {r.pending ? (
                  isAdmin ? (
                    <ResendInviteButton userId={r.id} />
                  ) : (
                    <span className="text-[12px] text-ink-tertiary">Hasn&rsquo;t signed in yet</span>
                  )
                ) : (
                  <TeamMemberDigestActions userId={r.id} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
