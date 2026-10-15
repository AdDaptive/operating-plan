import { format, parseISO } from "date-fns";
import { getKeyResultById } from "@/lib/db";

/** yyyy-MM-dd part of a stored/submitted date (works for "2026-10-20" and full ISO strings). */
export function dayOf(date: string): string {
  return date.slice(0, 10);
}

/**
 * A task can't be due after the project it belongs to. Returns an error
 * message when `dueDate` falls after the project's due date, or null when
 * it's fine (including projects with no due date set).
 */
export async function taskDueDateError(keyResultId: string, dueDate: string): Promise<string | null> {
  const kr = await getKeyResultById(keyResultId);
  if (!kr?.dueDate) return null;
  if (dayOf(dueDate) > dayOf(kr.dueDate)) {
    return `A task's due date can't be after its project's due date (${format(parseISO(dayOf(kr.dueDate)), "MMM d, yyyy")}).`;
  }
  return null;
}
