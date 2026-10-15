import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  archiveItem,
  restoreItem,
  getTaskById,
  getKeyResultById,
  getObjectiveById,
  getUserById,
  type ArchiveKind,
} from "@/lib/db";
import { canSeeChain, canSeeLevel, isInvolvedInTask, viewerFrom } from "@/lib/permissions";

/**
 * POST { kind: "task" | "keyResult" | "objective", id, action: "archive" | "restore" }.
 * Archiving a project or objective also archives what's under it;
 * restoring brings back what was archived along with it (see archiveItem /
 * restoreItem in src/lib/db.ts).
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { kind, id, action } = (body ?? {}) as { kind?: ArchiveKind; id?: string; action?: string };
  if (!id || (kind !== "task" && kind !== "keyResult" && kind !== "objective") || (action !== "archive" && action !== "restore")) {
    return NextResponse.json({ error: "kind, id, and action are required." }, { status: 400 });
  }

  // You can archive/restore what you could already edit: items you can see
  // at their level, plus tasks you own/sub-own and projects you own.
  const viewer = viewerFrom(await getUserById(userId));
  let allowed = false;
  if (kind === "task") {
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const kr = await getKeyResultById(task.keyResultId);
    const objective = kr ? await getObjectiveById(kr.objectiveId) : undefined;
    allowed = canSeeChain(viewer, task.level, kr?.level, objective?.level) || isInvolvedInTask(viewer, task);
  } else if (kind === "keyResult") {
    const kr = await getKeyResultById(id);
    if (!kr) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const objective = await getObjectiveById(kr.objectiveId);
    allowed = canSeeChain(viewer, kr.level, objective?.level) || kr.ownerId === userId;
  } else {
    const objective = await getObjectiveById(id);
    if (!objective) return NextResponse.json({ error: "Not found" }, { status: 404 });
    allowed = canSeeLevel(viewer, objective.level);
  }
  if (!allowed) return NextResponse.json({ error: "You don't have access to that item." }, { status: 403 });

  if (action === "archive") {
    await archiveItem(kind, id, userId);
    return NextResponse.json({ ok: true });
  }
  const result = await restoreItem(kind, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
