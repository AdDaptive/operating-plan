import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateObjective, deleteObjective } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, team, quarter } = body ?? {};

  const objective = await updateObjective(params.id, { title, team, quarter });
  if (!objective) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(objective);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteObjective(params.id);
  return NextResponse.json({ ok: true });
}
