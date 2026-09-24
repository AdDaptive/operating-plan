import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createKeyResult, getObjectiveById } from "@/lib/db";
import { notifyKeyResultAssigned } from "@/lib/notifications";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, dueDate, ownerId, objectiveId, level } = body ?? {};
  if (!title || !objectiveId) {
    return NextResponse.json({ error: "Title and objectiveId are required." }, { status: 400 });
  }
  if (!dueDate) {
    return NextResponse.json({ error: "Due date is required." }, { status: 400 });
  }

  const objective = await getObjectiveById(objectiveId);
  if (objective?.dueDate && dueDate > objective.dueDate) {
    return NextResponse.json(
      { error: "A key result's due date can't be after the objective's due date." },
      { status: 400 }
    );
  }

  const keyResult = await createKeyResult({
    title,
    dueDate,
    ownerId: ownerId || null,
    objectiveId,
    level: level || undefined,
  });

  // Same as task creation: notify the owner right away, awaited so it
  // completes before this serverless function's response is sent. A
  // no-op inside notifyKeyResultAssigned when there's no owner set.
  const creator = session.user as { id?: string; name?: string | null } | undefined;
  await notifyKeyResultAssigned(keyResult, { id: creator?.id, name: creator?.name });

  return NextResponse.json(keyResult, { status: 201 });
}
