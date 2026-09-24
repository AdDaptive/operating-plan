import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateKeyResult, deleteKeyResult, getKeyResultById, getObjectiveById } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, dueDate, ownerId, level } = body ?? {};

  if (dueDate) {
    const existing = await getKeyResultById(params.id);
    if (existing) {
      const objective = await getObjectiveById(existing.objectiveId);
      if (objective?.dueDate && dueDate > objective.dueDate) {
        return NextResponse.json(
          { error: "A key result's due date can't be after the objective's due date." },
          { status: 400 }
        );
      }
    }
  }

  const keyResult = await updateKeyResult(params.id, {
    title,
    dueDate,
    ownerId: ownerId === undefined ? undefined : ownerId || null,
    level,
  });
  if (!keyResult) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(keyResult);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteKeyResult(params.id);
  return NextResponse.json({ ok: true });
}
