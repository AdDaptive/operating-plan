import type { TaskPriority } from "@/lib/db";

/**
 * Eisenhower-style urgency/importance classification. Deliberately only
 * three levels -- there is no "not urgent / not important" option, matching
 * what was asked for. Order here is used anywhere the levels are listed,
 * e.g. the priority <select> in TaskModal.
 */
export const PRIORITY_ORDER: TaskPriority[] = [
  "URGENT_IMPORTANT",
  "URGENT_NOT_IMPORTANT",
  "IMPORTANT_NOT_URGENT",
];

export const PRIORITY_META: Record<
  TaskPriority,
  { label: string; bg: string; text: string }
> = {
  URGENT_IMPORTANT: {
    label: "Urgent / Important",
    bg: "#FDE8E8",
    text: "#B42318",
  },
  URGENT_NOT_IMPORTANT: {
    label: "Urgent / Not Important",
    bg: "#FEF3E0",
    text: "#92400E",
  },
  IMPORTANT_NOT_URGENT: {
    label: "Important / Not Urgent",
    bg: "#EAF1FE",
    text: "#1849A9",
  },
};
