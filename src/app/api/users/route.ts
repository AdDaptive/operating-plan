import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listUsers } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = (await listUsers()).map((u) => ({ id: u.id, name: u.name, email: u.email, managerId: u.managerId }));
  return NextResponse.json(users);
}
