import { differenceInCalendarDays, startOfDay } from "date-fns";
import type { TaskStatus } from "@/lib/db";

/** Tasks due this many days out (inclusive) count as "due soon". */
export const UPCOMING_WINDOW_DAYS = 3;

type Dated = { dueDate: string; status: TaskStatus };

/**
 * Buckets tasks into overdue / due today / due soon / flagged (At Risk or
 * Off Track, regardless of date) -- the same grouping the daily digest
 * uses (src/lib/digest.ts), reused as-is by the Home dashboard's "Your
 * tasks" section so both show the same thing the same way. Generic over
 * T so it works with any task-shaped object (TaskForReminder, or the
 * plain objective-flattened task shape Home builds), not just one type.
 */
export function bucketTasks<T extends Dated>(
  tasks: T[]
): { overdue: T[]; dueToday: T[]; dueSoon: T[]; flagged: T[] } {
  const today = startOfDay(new Date());
  const bucket: { overdue: T[]; dueToday: T[]; dueSoon: T[]; flagged: T[] } = {
    overdue: [],
    dueToday: [],
    dueSoon: [],
    flagged: [],
  };
  for (const t of tasks) {
    const days = differenceInCalendarDays(startOfDay(new Date(t.dueDate)), today);
    if (days < 0) bucket.overdue.push(t);
    else if (days === 0) bucket.dueToday.push(t);
    else if (days <= UPCOMING_WINDOW_DAYS) bucket.dueSoon.push(t);
    else if (t.status === "AT_RISK" || t.status === "OFF_TRACK") bucket.flagged.push(t);
  }
  return bucket;
}

/**
 * A task overdue, or flagged At Risk/Off Track regardless of date -- the
 * bar for showing up in a manager's "your team" rollup (both in the daily
 * digest and on the Home dashboard).
 */
export function isTeamFlag<T extends Dated>(t: T): boolean {
  const days = differenceInCalendarDays(startOfDay(new Date(t.dueDate)), startOfDay(new Date()));
  return days < 0 || t.status === "AT_RISK" || t.status === "OFF_TRACK";
}
