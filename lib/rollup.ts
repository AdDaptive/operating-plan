/** A key result's progress toward its target, clamped to 0-100. */
export function keyResultProgress(kr: { currentValue: number; targetValue: number }): number {
  if (!kr.targetValue) return 0;
  const pct = (kr.currentValue / kr.targetValue) * 100;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/** An objective's rollup progress: the average of its key results' progress. */
export function objectiveProgress(
  keyResults: { currentValue: number; targetValue: number }[]
): number {
  if (keyResults.length === 0) return 0;
  const total = keyResults.reduce((sum, kr) => sum + keyResultProgress(kr), 0);
  return Math.round(total / keyResults.length);
}
