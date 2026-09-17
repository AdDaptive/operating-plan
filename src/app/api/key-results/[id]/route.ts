import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { updateKeyResult, deleteKeyResult } from "@/lib/db";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, unit, targetValue, currentValue } = body ?? {};

  const keyResult = await updateKeyResult(params.id, { title, unit, targetValue, currentValue });
  if (!keyResult) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(keyResult);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await deleteKeyResult(params.id);
  return NextResponse.json({ ok: true });
}
