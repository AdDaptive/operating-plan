import type { ObjectiveFull, PermissionLevel } from "@/lib/db";

/**
 * Three-tier visibility level, settable independently on every objective,
 * key result, and task (see the `level` column added to each in db.ts),
 * plus on every user's own account (Team page, admin-only -- see
 * UserLevelSelect). Order here is least-visible-scope first; it's used
 * anywhere the levels are listed, e.g. the level <select>s in the create/
 * edit modals and the inline LevelSelect dropdowns.
 */
// Internal key stays EMPLOYEE (it's what's stored in the database column
// and would need a migration to rename), but it now displays as "All" --
// the bottom tier that every level, including itself, can see.
export const LEVEL_ORDER: PermissionLevel[] = ["EMPLOYEE", "MANAGER", "SENIOR_LEADERSHIP"];

export const LEVEL_META: Record<PermissionLevel, { label: string; bg: string; text: string }> = {
  EMPLOYEE: { label: "All", bg: "#F2F4F7", text: "#475467" },
  MANAGER: { label: "Manager", bg: "#EAF1FE", text: "#1849A9" },
  SENIOR_LEADERSHIP: { label: "Senior Leadership", bg: "#F4EBFF", text: "#6941C6" },
};

const LEVEL_RANK: Record<PermissionLevel, number> = {
  EMPLOYEE: 0,
  MANAGER: 1,
  SENIOR_LEADERSHIP: 2,
};

export type Viewer = { level: PermissionLevel; isAdmin: boolean; userId?: string };

/**
 * Hierarchical visibility: someone at a given level sees content at their
 * own level and every level below it (Senior Leadership sees everything,
 * Manager sees Manager + All, All sees only All-level content). Admins
 * always see everything, same as they're already a super-user for account
 * management (invites, resend-invite, editing someone's manager).
 */
export function canSeeLevel(viewer: Viewer, itemLevel: PermissionLevel): boolean {
  if (viewer.isAdmin) return true;
  return LEVEL_RANK[itemLevel] <= LEVEL_RANK[viewer.level];
}

/**
 * Same as canSeeLevel, but for a whole chain of ancestor levels at once
 * (used on the Activity page, where a task's own level, its key result's
 * level, and its objective's level all have to be visible -- a task
 * doesn't surface there just because its own level is low if the
 * objective it rolls up to is hidden from this viewer). A null/undefined
 * level in the chain (shouldn't normally happen -- key_results and tasks
 * cascade-delete with their parent) is treated as visible rather than
 * hiding the row over missing data.
 */
export function canSeeChain(viewer: Viewer, ...levels: (PermissionLevel | null | undefined)[]): boolean {
  return levels.every((level) => !level || canSeeLevel(viewer, level));
}

/** Builds a Viewer from the session's current UserRow (or undefined for a
 * missing/deleted account -- treated as the most restrictive case, the
 * unprivileged "All" level, rather than defaulting to "sees everything"). */
export function viewerFrom(user: { id: string; level: PermissionLevel; isAdmin: boolean } | undefined): Viewer {
  return user
    ? { level: user.level, isAdmin: user.isAdmin, userId: user.id }
    : { level: "EMPLOYEE", isAdmin: false };
}

/**
 * True when this person is the owner or the delegated sub-owner of the task.
 * Anything that involves you stays visible to you regardless of its level
 * (or its project's or objective's level) -- see visibleObjectives.
 */
export function isInvolvedInTask(
  viewer: Viewer,
  task: { ownerId?: string | null; subOwnerId?: string | null }
): boolean {
  return !!viewer.userId && (task.ownerId === viewer.userId || task.subOwnerId === viewer.userId);
}

/**
 * Filters a full objective tree (as returned by getObjectivesFull /
 * getObjectiveFull) down to what this viewer can see, cascading: an
 * objective the viewer can't see drops its key results and tasks with it,
 * and within a visible objective, individual key results and tasks are
 * filtered the same way. This is a read/browse-time filter only -- it
 * doesn't change who can edit an objective/key result/task's own fields
 * (including its level), which stays open to any signed-in person, same
 * as every other field on these three has always been.
 *
 * Personal exception: you always see your own work, even under an objective
 * or project your level can't otherwise see. Tasks you own or are
 * sub-owner of, and projects you own, are kept -- along with the project
 * and objective they sit under, so the item isn't orphaned -- but nothing
 * else in those hidden parents (other people's tasks, other projects) is
 * revealed. Callers can tell a limited, exception-only view of an objective
 * with `!canSeeLevel(viewer, objective.level)`.
 */
export function visibleObjectives<T extends ObjectiveFull>(objectives: T[], viewer: Viewer): T[] {
  const me = viewer.userId;
  const result: T[] = [];
  for (const o of objectives) {
    const objectiveVisible = canSeeLevel(viewer, o.level);
    const keyResults: T["keyResults"] = [];
    for (const kr of o.keyResults) {
      const keyResultVisible = objectiveVisible && canSeeLevel(viewer, kr.level);
      const tasks = kr.tasks.filter(
        (t) => (keyResultVisible && canSeeLevel(viewer, t.level)) || isInvolvedInTask(viewer, t)
      );
      const ownsKeyResult = !!me && kr.ownerId === me;
      if (keyResultVisible || ownsKeyResult || tasks.length > 0) {
        keyResults.push({ ...kr, tasks });
      }
    }
    if (objectiveVisible || keyResults.length > 0) {
      result.push({ ...o, keyResults });
    }
  }
  return result;
}

/**
 * "All"-level people (the bottom tier, shown as "All" in the UI) can create
 * and edit tasks like anyone else, but can only assign them to themselves --
 * as task owner or as sub-owner. Managers, Senior Leadership, and admins
 * can assign to anyone. Enforced server-side in the tasks API routes; the
 * task modal also narrows its Owner/Sub-owner dropdowns to match so people
 * aren't offered choices the server will refuse.
 */
/**
 * Managers and "All"-level people only see their own items (tasks they own
 * or are sub-owner of) on the Activity page; Senior Leadership and admins
 * keep the org-wide view.
 */
export function seesOnlyOwnActivity(viewer: Viewer): boolean {
  return !viewer.isAdmin && viewer.level !== "SENIOR_LEADERSHIP";
}

export function mustAssignToSelf(viewer: Viewer): boolean {
  return !viewer.isAdmin && viewer.level === "EMPLOYEE";
}
