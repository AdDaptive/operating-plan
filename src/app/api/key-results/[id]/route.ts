import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateKeyResult, deleteKeyResult, getKeyResultById, getObjectiveById, getUserById, countTasksDueAfter } from "@/lib/db";
import { canSeeChain, canSeeLevel, viewerFrom } from "@/lib/permissions";
import { dayOf } from "@/lib/taskDueDate";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, dueDate, ownerId, level, objectiveId } = body ?? {};
  const actingUserId = (session.user as { id?: string } | undefined)?.id;

  const existing = await getKeyResultById(params.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Moving the project to a different objective (its tasks go with it).
  const moving = !!objectiveId && objectiveId !== existing.objectiveId;
  const currentObjective = await getObjectiveById(existing.objectiveId);
  let dueObjective = currentObjective;
  if (moving) {
    const target = await getObjectiveById(objectiveId);
    if (!target || target.archivedAt) {
      return NextResponse.json({ error: "That objective doesn't exist or is archived." }, { status: 400 });
    }
    const viewer = viewerFrom(actingUserId ? await getUserById(actingUserId) : undefined);
    const mayMoveFrom = canSeeChain(viewer, existing.level, currentObjective?.level) || existing.ownerId === actingUserId;
    if (!mayMoveFrom || !canSeeLevel(viewer, target.level)) {
      return NextResponse.json({ error: "You don't have access to move this project there." }, { status: 403 });
    }
    dueObjective = target;
  }

  // A project can't be due after its objective (the new one, if moving).
  const nextDueDate: string | null = dueDate || existing.dueDate;
  if ((dueDate || moving) && nextDueDate && dueObjective?.dueDate && nextDueDate > dueObjective.dueDate) {
    return NextResponse.json(
      {
        error: moving
          ? "This project's due date is after the new objective's due date. Move it to a later objective or set an earlier project due date."
          : "A project's due date can't be after the objective's due date.",
      },
      { status: 400 }
    );
  }

  // Moving a project's date earlier can't strand tasks past it.
  if (dueDate && (!existing.dueDate || dayOf(dueDate) !== dayOf(existing.dueDate))) {
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
      objectiveId: moving ? objectiveId : undefined,
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
