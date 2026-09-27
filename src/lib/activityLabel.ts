import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";
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
export type ActivityFreshness = "today" | "yesterday" | "last7" | "stale" | "never";

/**
 * The "last 7 days" / "not changed in the last 7 days" split (added
 * 2026-09-27, replacing the earlier 3-tier green/yellow/red scheme) --
 * an easily-adjustable convention, same as `STATUS_PROGRESS` in
 * status.ts -- not a fixed rule.
 */
const FRESHNESS_WINDOW_DAYS = 7;

export const FRESHNESS_META: Record<
  ActivityFreshness,
  { label: string; bg: string; text: string; dot: string }
> = {
  today: {
    label: "Changed today",
    bg: "#E6F4EA",
    text: "#1E7B34",
    dot: "#2FA84F",
  },
  yesterday: {
    label: "Changed yesterday",
    bg: "#E0F2FE",
    text: "#075985",
    dot: "#0EA5E9",
  },
  last7: {
    label: "Changed in the last 7 days",
    bg: "#FEF3E0",
    text: "#92400E",
    dot: "#F59E0B",
  },
  stale: {
    label: "Not changed in the last 7 days",
    bg: "#F2F4F7",
    text: "#475467",
    dot: "#98A2B3",
  },
  never: {
    label: "Never changed",
    bg: "#FBEAE9",
    text: "#B42318",
    dot: "#E11D2E",
  },
};

/**
 * Classifies a task's staleness from the timestamp of its most recent
 * tracked change (status/due date/sub-owner/details/notes) into one of
 * five calendar-day-based buckets: "today" or "yesterday" (by calendar
 * day, not a rolling 24-hour window, so a change at 11pm yesterday and
 * one at 1am today both read naturally), "last7" (changed within the
 * last `FRESHNESS_WINDOW_DAYS` days but not today or yesterday), "stale"
 * (has changed at some point, just longer ago than that), or "never" (no
 * tracked change has ever been logged at all). These five are mutually
 * exclusive and collectively exhaustive over every possible
 * `lastChangedAt` value, so sorting a task list by `lastChangedAt`
 * descending (nulls last) still produces exactly these five tiers in
 * order with no extra grouping logic needed -- see the Activity page's
 * sort comment.
 */
export function activityFreshness(lastChangedAt: string | null): ActivityFreshness {
  if (!lastChangedAt) return "never";
  const changedAt = new Date(lastChangedAt);
  if (isToday(changedAt)) return "today";
  if (isYesterday(changedAt)) return "yesterday";
  const daysAgo = differenceInCalendarDays(new Date(), changedAt);
  return daysAgo <= FRESHNESS_WINDOW_DAYS ? "last7" : "stale";
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
