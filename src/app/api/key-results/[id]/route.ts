import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateKeyResult, deleteKeyResult, getKeyResultById, getObjectiveById, countTasksDueAfter } from "@/lib/db";
import { dayOf } from "@/lib/taskDueDate";

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
          { error: "A project's due date can't be after the objective's due date." },
          { status: 400 }
        );
      }
      // Moving a project's date earlier can't strand tasks past it.
      if (!existing.dueDate || dayOf(dueDate) !== dayOf(existing.dueDate)) {
        const late = await countTasksDueAfter(params.id, dayOf(dueDate));
        if (late > 0) {
          return NextResponse.json(
            {
              error: `${late} task${late === 1 ? " is" : "s are"} due after that date. Move ${late === 1 ? "its" : "their"} due date${late === 1 ? "" : "s"} up first, or choose a later project due date.`,
            },
            { status: 400 }
          );
        }
      }
    }
  }

  // Who's making this edit -- recorded on any key_result_activity rows
  // this update produces (see updateKeyResult's change-log diffing).
  const actingUser = session.user as { id?: string } | undefined;

  const keyResult = await updateKeyResult(
    params.id,
    {
      title,
      dueDate,
      ownerId: ownerId === undefined ? undefined : ownerId || null,
      level,
    },
    actingUser?.id ?? null
  );
  if (!keyResult) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(keyResult);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteKeyResult(params.id);
  return NextResponse.json({ ok: true });
}
