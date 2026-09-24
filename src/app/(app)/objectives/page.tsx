import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getObjectivesFull, getUserById } from "@/lib/db";
import { objectiveProgress } from "@/lib/rollup";
import { viewerFrom, visibleObjectives } from "@/lib/permissions";
import ObjectiveCard from "@/components/ObjectiveCard";
import ObjectiveModal from "@/components/ObjectiveModal";

export default async function ObjectivesPage() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;

  const [allObjectives, currentUser] = await Promise.all([
    getObjectivesFull(),
    sessionUserId ? getUserById(sessionUserId) : Promise.resolve(undefined),
  ]);
  const objectives = visibleObjectives(allObjectives, viewerFrom(currentUser));

  const cards = objectives.map((o) => {
    const tasks = o.keyResults.flatMap((kr) => kr.tasks);
    const owners = Array.from(new Set(tasks.map((t) => t.owner.name)));
    return {
      id: o.id,
      title: o.title,
      team: o.team,
      dueDate: o.dueDate,
      level: o.level,
      progress: objectiveProgress(o.keyResults),
      taskCount: tasks.length,
      owners,
      keyResults: o.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        status: kr.status,
      })),
    };
  });

  return (
    <>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-between gap-y-2 border-b border-line bg-white px-4 py-4 md:px-7 md:py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Objectives</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {cards.length} active objective{cards.length === 1 ? "" : "s"}
          </p>
        </div>
        <ObjectiveModal />
      </div>

      <div className="flex-grow overflow-y-auto p-4 md:p-7">
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-card border border-dashed border-line bg-white py-20 text-center">
            <p className="font-display text-[16px] font-bold text-ink">No objectives yet</p>
            <p className="max-w-sm text-[13px] text-ink-secondary">
              Create your first objective, then add key results and tasks to it from its
              task board.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((c, i) => (
              <ObjectiveCard key={c.id} objective={c} index={i} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
