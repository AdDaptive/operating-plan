import type { TaskStatus } from "@/lib/db";

export const STATUS_ORDER: TaskStatus[] = [
  "NOT_STARTED",
  "ON_TRACK",
  "AT_RISK",
  "OFF_TRACK",
  "DONE",
];

export const STATUS_META: Record<
  TaskStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  NOT_STARTED: {
    label: "Not Started",
    bg: "#F2F4F7",
    text: "#475467",
    dot: "#98A2B3",
  },
  ON_TRACK: {
    label: "On Track",
    bg: "#E6F4EA",
    text: "#1E7B34",
    dot: "#2FA84F",
  },
  AT_RISK: {
    label: "At Risk",
    bg: "#FEF3E0",
    text: "#92400E",
    dot: "#F59E0B",
  },
  OFF_TRACK: {
    label: "Off Track",
    bg: "#FCEAEA",
    text: "#B42318",
    dot: "#E5484D",
  },
  DONE: {
    label: "Done",
    bg: "#EAF1FE",
    text: "#1849A9",
    dot: "#3B82F6",
  },
};

/**
 * Since key results now carry a manually-set status (like tasks) instead of
 * a current/target number, this is what turns that status into a progress
 * percentage for the progress bars and the objective rollup. Tweak these
 * five numbers any time to change how "far along" each status counts as.
 */
export const STATUS_PROGRESS: Record<TaskStatus, number> = {
  NOT_STARTED: 0,
  ON_TRACK: 60,
  AT_RISK: 40,
  OFF_TRACK: 20,
  DONE: 100,
};

export function isOverdue(dueDate: string | Date, status: TaskStatus): boolean {
  if (status === "DONE") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
}
