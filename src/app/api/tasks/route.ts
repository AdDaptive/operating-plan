import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createTask } from "@/lib/db";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { title, status, dueDate, ownerId, keyResultId } = body ?? {};
  if (!title || !dueDate || !ownerId || !keyResultId) {
    return NextResponse.json(
      { error: "title, dueDate, ownerId, and keyResultId are required." },
      { status: 400 }
    );
  }

  const task = await createTask({ title, status, dueDate, ownerId, keyResultId });
  return NextResponse.json(task, { status: 201 });
}
