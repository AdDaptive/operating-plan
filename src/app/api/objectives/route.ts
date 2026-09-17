import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getObjectivesFull, createObjective } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(await getObjectivesFull());
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, team, quarter } = body ?? {};
  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });

  const objective = await createObjective({ title, team: team || null, quarter: quarter || "Q3 2026" });
  return NextResponse.json(objective, { status: 201 });
}
