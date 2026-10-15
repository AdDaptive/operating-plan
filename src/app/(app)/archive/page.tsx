import { format } from "date-fns";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listArchived, getUserById, type UserRow } from "@/lib/db";
import { viewerFrom, isInvolvedInTask, seesOnlyOwnActivity } from "@/lib/permissions";
import { initials, colorForName } from "@/lib/avatar";
import RestoreButton from "@/components/RestoreButton";

function Person({ user, fallback = "—" }: { user: UserRow | null; fallback?: string }) {
  if (!user) return <span className="text-[12.5px] text-ink-tertiary">{fallback}</span>;
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex h-[20px] w-[20px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ background: colorForName(user.name) }}
      >
        {initials(user.name)}
      </div>
      <span className="truncate text-[12.5px] text-[#344054]">{user.name}</span>
    </div>
  );
}

const GRID = "md:grid-cols-[1.4fr_1.2fr_140px_170px_110px]";

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-7">
      <h2 className="mb-3 text-[15px] font-bold text-ink">
        {title} <span className="font-medium text-ink-tertiary">({count})</span>
      </h2>
      <div className="overflow-hidden rounded-card border border-line bg-white">
        {count === 0 ? (
          <div className="px-5 py-8 text-center text-[13px] text-ink-tertiary">Nothing archived here.</div>
        ) : (
          <>
            <div className={`hidden gap-3 bg-surface-panel px-5 py-2.5 text-[10.5px] font-bold tracking-wide text-ink-tertiary md:grid ${GRID}`}>
              <span>NAME</span>
              <span>BELONGS TO</span>
              <span>OWNER</span>
              <span>ARCHIVED</span>
              <span />
            </div>
            {children}
          </>
        )}
      </div>
    </div>
  );
}

function ArchivedWhen({ at, by }: { at: string | null | undefined; by: UserRow | null }) {
  return (
    <div className="flex flex-col">
      <span className="text-[12.5px] text-ink-secondary">{at ? format(new Date(at), "MMM d, yyyy") : "—"}</span>
      {by && <span className="truncate text-[11.5px] text-ink-tertiary">by {by.name}</span>}
    </div>
  );
}

/**
 * Everything that's been archived: objectives, projects, and tasks. Archived
 * items are hidden from the boards, Projects, Home, Reports, Team, Activity
 * and the daily digest, and nothing in them is deleted -- Restore puts an
 * item back (and whatever was archived along with it). Senior Leadership and
 * admins see all of it; Managers and "All"-level people see only their own
 * tasks and projects here, same as the Activity page.
 */
export default async function ArchivePage() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const [archived, currentUser] = await Promise.all([
    listArchived(),
    userId ? getUserById(userId) : Promise.resolve(undefined),
  ]);
  const viewer = viewerFrom(currentUser);
  const ownOnly = seesOnlyOwnActivity(viewer);

  const objectives = ownOnly ? [] : archived.objectives;
  const keyResults = ownOnly ? archived.keyResults.filter((kr) => kr.ownerId === userId) : archived.keyResults;
  const tasks = ownOnly ? archived.tasks.filter((t) => isInvolvedInTask(viewer, t)) : archived.tasks;
  const total = objectives.length + keyResults.length + tasks.length;

  return (
    <>
      <div className="flex-shrink-0 border-b border-line bg-white px-4 py-4 md:px-7 md:py-5">
        <h1 className="font-display text-[21px] font-bold text-ink">Archive</h1>
        <p className="mt-1 text-[13px] text-ink-secondary">
          {total} archived item{total === 1 ? "" : "s"}. Archived items are hidden everywhere else; restore one to bring it back.
        </p>
      </div>

      <div className="flex-grow overflow-y-auto p-4 md:p-7">
        {!ownOnly && (
          <Section title="Objectives" count={objectives.length}>
            {objectives.map((o) => (
              <div
                key={o.id}
                className={`flex flex-col gap-1.5 border-t border-[#F2F4F7] px-5 py-3 md:grid md:items-center md:gap-3 ${GRID}`}
              >
                <div className="truncate text-[13.5px] font-medium text-ink">{o.title}</div>
                <span className="truncate text-[12.5px] text-ink-secondary">{o.team || "—"}</span>
                <span className="text-[12.5px] text-ink-tertiary">—</span>
                <ArchivedWhen at={o.archivedAt} by={o.archivedBy} />
                <RestoreButton kind="objective" id={o.id} />
              </div>
            ))}
          </Section>
        )}

        <Section title="Projects" count={keyResults.length}>
          {keyResults.map((kr) => (
            <div
              key={kr.id}
              className={`flex flex-col gap-1.5 border-t border-[#F2F4F7] px-5 py-3 md:grid md:items-center md:gap-3 ${GRID}`}
            >
              <div className="truncate text-[13.5px] font-medium text-ink">{kr.title}</div>
              <span className="truncate text-[12.5px] text-ink-secondary">{kr.objectiveTitle || "—"}</span>
              <Person user={kr.owner} fallback="Unassigned" />
              <ArchivedWhen at={kr.archivedAt} by={kr.archivedBy} />
              <RestoreButton
                kind="keyResult"
                id={kr.id}
                blockedReason={kr.parentArchived ? "Restore its objective first" : undefined}
              />
            </div>
          ))}
        </Section>

        <Section title="Tasks" count={tasks.length}>
          {tasks.map((t) => (
            <div
              key={t.id}
              className={`flex flex-col gap-1.5 border-t border-[#F2F4F7] px-5 py-3 md:grid md:items-center md:gap-3 ${GRID}`}
            >
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium text-ink">{t.title}</div>
                {t.objectiveTitle && <div className="truncate text-[11.5px] text-ink-tertiary">{t.objectiveTitle}</div>}
              </div>
              <span className="truncate text-[12.5px] text-ink-secondary">{t.keyResultTitle || "—"}</span>
              <Person user={t.owner} fallback="Unassigned" />
              <ArchivedWhen at={t.archivedAt} by={t.archivedBy} />
              <RestoreButton
                kind="task"
                id={t.id}
                blockedReason={t.parentArchived ? "Restore its project first" : undefined}
              />
            </div>
          ))}
        </Section>
      </div>
    </>
  );
}
