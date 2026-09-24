import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTask } from "@/lib/db";
import { notifyTaskAssigned } from "@/lib/notifications";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, status, dueDate, ownerId, subOwnerId, priority, keyResultId, level, description, notes } = body ?? {};
  if (!title || !dueDate || !ownerId || !keyResultId) {
    return NextResponse.json(
      { error: "title, dueDate, ownerId, and keyResultId are required." },
      { status: 400 }
    );
  }

  const task = await createTask({
    title,
    status,
    dueDate,
    ownerId,
    subOwnerId,
    priority,
    keyResultId,
    level: level || undefined,
    description,
    notes,
  });

  // Notify the owner right away over email/Slack -- separate from (and in
  // addition to) the daily digest. Awaited (not fire-and-forget) since a
  // serverless function can be frozen the instant the response is sent,
  // with no guarantee a detached async call finishes; a notifier failure
  // is caught inside notifyTaskAssigned itself and never fails this request.
  const creator = session.user as { id?: string; name?: string | null } | undefined;
  await notifyTaskAssigned(task, { id: creator?.id, name: creator?.name });

  return NextResponse.json(task, { status: 201 });
}
