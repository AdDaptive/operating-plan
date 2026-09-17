import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createKeyResult } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, unit, targetValue, currentValue, objectiveId } = body ?? {};
  if (!title || !objectiveId) {
    return NextResponse.json({ error: "Title and objectiveId are required." }, { status: 400 });
  }

  const keyResult = await createKeyResult({
    title,
    unit: unit || "%",
    targetValue: targetValue ?? 100,
    currentValue: currentValue ?? 0,
    objectiveId,
  });
  return NextResponse.json(keyResult, { status: 201 });
}
