import type { TaskStatus } from "@/lib/db";
import { STATUS_PROGRESS } from "@/lib/status";

/** A key result's progress, driven by its manually-set status. */
export function keyResultProgress(kr: { status: TaskStatus }): number {
  return STATUS_PROGRESS[kr.status];
}

/** An objective's rollup progress: the average of its key results' progress. */
export function objectiveProgress(keyResults: { status: TaskStatus }[]): number {
  if (keyResults.length === 0) return 0;
  const total = keyResults.reduce((sum, kr) => sum + keyResultProgress(kr), 0);
  return Math.round(total / keyResults.length);
}
