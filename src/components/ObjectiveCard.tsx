import Link from "next/link";
import { keyResultProgress } from "@/lib/rollup";
import { initials, colorForName } from "@/lib/avatar";

function ringStyle(progress: number, color: string) {
  const deg = Math.round((progress / 100) * 360);
  return {
    background: `conic-gradient(${color} 0deg ${deg}deg, #EEF0F3 ${deg}deg 360deg)`,
    borderRadius: "999px",
    width: 48,
    height: 48,
    flexShrink: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } as const;
}

export type ObjectiveCardData = {
  id: string;
  title: string;
  team: string | null;
  progress: number;
  taskCount: number;
  owners: string[];
  keyResults: { id: string; title: string; unit: string; targetValue: number; currentValue: number }[];
};

export default function ObjectiveCard({ objective, index }: { objective: ObjectiveCardData; index: number }) {
  const palette = ["#4338CA", "#0E9384", "#B45309", "#2D6CDF"];
  const ringColor = palette[index % palette.length];

  return (
    <Link
      href={`/board/${objective.id}`}
      className="flex flex-col gap-4 rounded-card border border-line bg-white p-5 transition hover:border-[#D0D5DD] hover:shadow-[0_4px_14px_rgba(16,24,40,0.06)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 text-[10px] font-bold tracking-wide text-ink-tertiary">
            OBJECTIVE
          </div>
          <div className="text-[15.5px] font-bold leading-snug text-ink">{objective.title}</div>
          {objective.team && (
            <div className="mt-1 text-[12px] text-ink-secondary">{objective.team}</div>
          )}
        </div>
        <div style={ringStyle(objective.progress, ringColor)}>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[11px] font-bold text-ink">
            {objective.progress}%
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3.5">
        {objective.keyResults.length === 0 && (
          <p className="text-[12.5px] text-ink-tertiary">No key results yet.</p>
        )}
        {objective.keyResults.map((kr) => {
          const progress = keyResultProgress(kr);
          return (
            <div key={kr.id}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] font-semibold text-[#344054]">{kr.title}</span>
                <span className="whitespace-nowrap text-[11.5px] text-ink-tertiary">
                  {kr.currentValue}
                  {kr.unit === "%" ? "%" : ` ${kr.unit}`} / {kr.targetValue}
                  {kr.unit === "%" ? "%" : ` ${kr.unit}`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-[#EEF0F3]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${progress}%`, background: ringColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-[#EEF0F3] pt-3.5">
        <div className="flex">
          {objective.owners.slice(0, 4).map((name, i) => (
            <div
              key={name + i}
              className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white text-[10px] font-bold text-white first:ml-0"
              style={{ background: colorForName(name) }}
              title={name}
            >
              {initials(name)}
            </div>
          ))}
        </div>
        <span className="text-[12px] text-ink-tertiary">{objective.taskCount} tasks</span>
      </div>
    </Link>
  );
}
