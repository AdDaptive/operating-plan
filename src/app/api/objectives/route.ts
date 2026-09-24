import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getObjectivesFull, createObjective, getUserById } from "@/lib/db";
import { viewerFrom, visibleObjectives } from "@/lib/permissions";

export async function GET() {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !sessionUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [objectives, requester] = await Promise.all([getObjectivesFull(), getUserById(sessionUserId)]);
  return NextResponse.json(visibleObjectives(objectives, viewerFrom(requester)));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, team, dueDate, level } = body ?? {};
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!dueDate) return NextResponse.json({ error: "Due date is required." }, { status: 400 });

  const objective = await createObjective({ title, team: team || null, dueDate, level: level || undefined });
  return NextResponse.json(objective, { status: 201 });
}
