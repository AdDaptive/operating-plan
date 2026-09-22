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
export type ActivityFreshness = "green" | "yellow" | "red";

const FRESHNESS_WINDOW_DAYS = 7;

export const FRESHNESS_META: Record<
  ActivityFreshness,
  { label: string; bg: string; text: string; dot: string }
> = {
  green: {
    label: "Changed this week",
    bg: "#E6F4EA",
    text: "#1E7B34",
    dot: "#2FA84F",
  },
  yellow: {
    label: "Changed a while ago",
    bg: "#FEF3E0",
    text: "#92400E",
    dot: "#F59E0B",
  },
  red: {
    label: "Never changed",
    bg: "#FBEAE9",
    text: "#B42318",
    dot: "#E11D2E",
  },
};

/**
 * Classifies a task's staleness from the timestamp of its most recent
 * tracked change (status/due date/sub-owner/details/notes) -- green if
 * something changed within the last week, yellow if it has changed but
 * not recently, red if it has never had a tracked change logged at all.
 * `FRESHNESS_WINDOW_DAYS` is an easily-adjustable convention, same as
 * `STATUS_PROGRESS` in status.ts -- not a fixed rule.
 */
export function activityFreshness(lastChangedAt: string | null): ActivityFreshness {
  if (!lastChangedAt) return "red";
  const ageMs = Date.now() - new Date(lastChangedAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays <= FRESHNESS_WINDOW_DAYS ? "green" : "yellow";
}

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
