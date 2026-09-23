import type { ObjectiveFull, TaskWithOwner, TaskPriority } from "@/lib/db";
import { PRIORITY_ORDER } from "@/lib/priority";

/**
 * One key result's slice of a meeting agenda: the key result itself (plus
 * which objective it rolls up to) and the subset of its tasks relevant to
 * the agenda's attendees, already sorted. Built by buildMeetingAgendaSections
 * below -- shared by the agenda page (src/app/(app)/agenda/[id]/page.tsx)
 * and the agenda email (sendMeetingAgendaEmail in notifications.ts) so both
 * surfaces always agree on what's in an agenda.
 */
export type AgendaKeyResultSection = {
  keyResultId: string;
  keyResultTitle: string;
  keyResultOwnerName: string | null;
  objectiveId: string;
  objectiveTitle: string;
  tasks: TaskWithOwner[];
};

/** Lower is more urgent. A null/unset priority always sorts last. */
function priorityRank(p: TaskPriority | null): number {
  if (!p) return PRIORITY_ORDER.length;
  const i = PRIORITY_ORDER.indexOf(p);
  return i === -1 ? PRIORITY_ORDER.length : i;
}

/** Highest priority first, then soonest due date -- the ordering the user asked for. */
function compareTasks(a: TaskWithOwner, b: TaskWithOwner): number {
  const pr = priorityRank(a.priority) - priorityRank(b.priority);
  if (pr !== 0) return pr;
  return a.dueDate.localeCompare(b.dueDate);
}

/**
 * Builds the agenda content for a given set of attendee user ids, computed
 * live from the current objectives/key-results/tasks -- deliberately not a
 * frozen snapshot, so the agenda page and a re-send of the email always
 * reflect whatever's true right up until the meeting.
 *
 * A key result is included if an attendee owns it directly, OR if any of
 * its tasks match an attendee as owner or delegated sub-owner. Within an
 * included key result, only the matching tasks are listed (not every task
 * under it) -- an attendee-owned key result with no matching tasks still
 * gets its own (empty) section, so it's visible on the agenda for
 * discussion even without a task to point to yet.
 *
 * Key-result sections are ordered by their own best (highest-priority,
 * then soonest-due) task; a section with no matching tasks sorts after
 * every section that has one, alphabetically among themselves.
 */
export function buildMeetingAgendaSections(
  objectives: ObjectiveFull[],
  attendeeIds: string[]
): AgendaKeyResultSection[] {
  const attendeeSet = new Set(attendeeIds);
  const sections: AgendaKeyResultSection[] = [];

  for (const objective of objectives) {
    for (const kr of objective.keyResults) {
      const matchingTasks = kr.tasks.filter(
        (t) => attendeeSet.has(t.ownerId) || (t.subOwnerId !== null && attendeeSet.has(t.subOwnerId))
      );
      const krOwnedByAttendee = kr.ownerId !== null && attendeeSet.has(kr.ownerId);
      if (matchingTasks.length === 0 && !krOwnedByAttendee) continue;

      sections.push({
        keyResultId: kr.id,
        keyResultTitle: kr.title,
        keyResultOwnerName: kr.owner?.name ?? null,
        objectiveId: objective.id,
        objectiveTitle: objective.title,
        tasks: [...matchingTasks].sort(compareTasks),
      });
    }
  }

  sections.sort((a, b) => {
    const aTask = a.tasks[0];
    const bTask = b.tasks[0];
    if (aTask && bTask) return compareTasks(aTask, bTask);
    if (aTask && !bTask) return -1;
    if (!aTask && bTask) return 1;
    return a.keyResultTitle.localeCompare(b.keyResultTitle);
  });

  return sections;
}
