import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateTask, deleteTask } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, status, dueDate, ownerId, subOwnerId, priority, keyResultId, level, description, notes } = body ?? {};

  // Who's making this edit -- recorded on any task_activity rows this
  // update produces (see updateTask's movement-log diffing).
  const actingUser = session.user as { id?: string } | undefined;

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
