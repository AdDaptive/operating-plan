import { getObjectivesFull } from "@/lib/db";
import { objectiveProgress } from "@/lib/rollup";
import ObjectiveCard from "@/components/ObjectiveCard";
import ObjectiveModal from "@/components/ObjectiveModal";

export default async function ObjectivesPage() {
  const objectives = await getObjectivesFull();

  const cards = objectives.map((o) => {
    const tasks = o.keyResults.flatMap((kr) => kr.tasks);
    const owners = Array.from(new Set(tasks.map((t) => t.owner.name)));
    return {
      id: o.id,
      title: o.title,
      team: o.team,
      progress: objectiveProgress(o.keyResults),
      taskCount: tasks.length,
      owners,
      keyResults: o.keyResults.map((kr) => ({
        id: kr.id,
        title: kr.title,
        unit: kr.unit,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue,
      })),
    };
  });

  return (
    <>
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-7 py-5">
        <div>
          <h1 className="font-display text-[21px] font-bold text-ink">Objectives</h1>
          <p className="mt-1 text-[13px] text-ink-secondary">
            {cards.length} active objective{cards.length === 1 ? "" : "s"} this quarter
          </p>
        </div>
        <ObjectiveModal />
      </div>

      <div className="flex-grow overflow-y-auto p-7">
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
