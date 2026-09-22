import { format } from "date-fns";
import type { TaskActivityField, TaskStatus } from "@/lib/db";
import { STATUS_META } from "@/lib/status";

export const ACTIVITY_FIELD_LABELS: Record<TaskActivityField, string> = {
  status: "Status",
  dueDate: "Due date",
  subOwnerId: "Sub-owner",
  description: "Details",
  notes: "Notes",
};

const MAX_TEXT_PREVIEW = 80;

/**
 * Turns a raw value stored on a task_activity row (the plain string or
 * null that was actually written to the tasks table at that point in
 * time) into something readable in the movement log -- a status pill's
 * label, a formatted date, a sub-owner's name looked up by id, or a
 * truncated preview of a freeform Details/Notes paragraph. Shared between
 * the per-task history panel (TaskModal) and the org-wide /activity page
 * so the two formats never drift apart.
 */
export function formatActivityValue(
  field: TaskActivityField,
  value: string | null,
  userById: Map<string, { name: string }>
): string {
  switch (field) {
    case "status":
      return value ? (STATUS_META[value as TaskStatus]?.label ?? value) : "—";
    case "dueDate":
      return value ? format(new Date(value), "MMM d, yyyy") : "—";
    case "subOwnerId":
      return value ? (userById.get(value)?.name ?? "Unknown person") : "— None —";
    case "description":
    case "notes":
      if (!value) return "(cleared)";
      return value.length > MAX_TEXT_PREVIEW ? `${value.slice(0, MAX_TEXT_PREVIEW)}…` : value;
    default:
      return value ?? "—";
  }
}
