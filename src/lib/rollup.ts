import type { TaskStatus } from "@/lib/db";
import { STATUS_PROGRESS } from "@/lib/status";

/**
 * Worst-status-wins order used to derive a key result's status from its
 * tasks (see computeKeyResultStatus below). This is deliberately its own
 * ranking -- separate from STATUS_ORDER (dropdown display order) and
 * STATUS_PROGRESS (percentage mapping) -- and, like STATUS_PROGRESS, is an
 * easily-adjustable convention rather than a fixed rule. Earlier in this
 * list = more severe / wins over anything later in it. IN_PROGRESS sits
 * right after NOT_STARTED: started but not yet vouched for as On Track.
 */
const STATUS_SEVERITY: TaskStatus[] = ["AT_RISK", "NOT_STARTED", "IN_PROGRESS", "ON_TRACK", "DONE"];

/**
 * A key result no longer has a manually-set status -- it's derived from
 * its tasks, worst status wins: if any task is At Risk, the key result is
 * At Risk; else if any task hasn't been started, it's Not Started; else if
 * every task is Done, it's Done; otherwise (everything left is On Track,
 * or a mix of On Track and Done) it's On Track. A key result with no tasks
 * yet defaults to Not Started. ("Off Track" was removed as a status
 * option entirely -- see src/lib/status.ts.)
 */
export function computeKeyResultStatus(tasks: { status: TaskStatus }[]): TaskStatus {
  if (tasks.length === 0) return "NOT_STARTED";
  let worst: TaskStatus = "DONE";
  let worstRank = STATUS_SEVERITY.indexOf(worst);
  for (const t of tasks) {
    const rank = STATUS_SEVERITY.indexOf(t.status);
    if (rank < worstRank) {
      worst = t.status;
      worstRank = rank;
    }
  }
  return worst;
}

/** A key result's progress, driven by its (derived) status. */
export function keyResultProgress(kr: { status: TaskStatus }): number {
  return STATUS_PROGRESS[kr.status];
}

/** An objective's rollup progress: the average of its key results' progress. */
export function objectiveProgress(keyResults: { status: TaskStatus }[]): number {
  if (keyResults.length === 0) return 0;
  const total = keyResults.reduce((sum, kr) => sum + keyResultProgress(kr), 0);
  return Math.round(total / keyResults.length);
}
