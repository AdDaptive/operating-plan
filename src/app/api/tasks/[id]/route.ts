import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateTask, deleteTask, getTaskById, getUserById } from "@/lib/db";
import { mustAssignToSelf, viewerFrom } from "@/lib/permissions";
import { taskDueDateError, dayOf } from "@/lib/taskDueDate";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, status, dueDate, ownerId, subOwnerId, priority, keyResultId, level, description, notes } = body ?? {};

  // A task can't be due after its project. Only checked when the due date
  // or project is actually being changed, so unrelated edits (status,
  // notes, ...) to an older task that already sits past its project's date
  // still go through.
  if (dueDate || keyResultId) {
    const current = await getTaskById(params.id);
    if (current) {
      const nextDue = dueDate || current.dueDate;
      const nextKr = keyResultId || current.keyResultId;
      if (dayOf(nextDue) !== dayOf(current.dueDate) || nextKr !== current.keyResultId) {
        const dueError = await taskDueDateError(nextKr, nextDue);
        if (dueError) return NextResponse.json({ error: dueError }, { status: 400 });
      }
    }
  }

  // Who's making this edit -- recorded on any task_activity rows this
  // update produces (see updateTask's movement-log diffing).
  const actingUser = session.user as { id?: string } | undefined;

  // "All"-level (non-admin) people can edit tasks, but can't hand one to
  // someone else: they may keep the current owner/sub-owner as-is or set
  // themselves, nothing else -- see mustAssignToSelf in src/lib/permissions.ts.
  const actingUserRow = actingUser?.id ? await getUserById(actingUser.id) : undefined;
  if (mustAssignToSelf(viewerFrom(actingUserRow))) {
    const existing = await getTaskById(params.id);
    if (existing) {
      const self = actingUser?.id;
      const ownerToOther = ownerId !== undefined && ownerId !== existing.ownerId && ownerId !== self;
      const subOwnerToOther = !!subOwnerId && subOwnerId !== existing.subOwnerId && subOwnerId !== self;
      if (ownerToOther || subOwnerToOther) {
        return NextResponse.json({ error: "You can only assign tasks to yourself." }, { status: 403 });
      }
    }
  }

  const task = await updateTask(
    params.id,
    {
      title,
      status,
      dueDate,
      ownerId,
      subOwnerId,
      priority,
      keyResultId,
      level,
      description,
      notes,
    },
    actingUser?.id ?? null
  );
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(task);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteTask(params.id);
  return NextResponse.json({ ok: true });
}
