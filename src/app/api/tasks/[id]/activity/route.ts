import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listTaskActivityForTask } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activity = await listTaskActivityForTask(params.id);
  return NextResponse.json(
    activity.map((a) => ({
      id: a.id,
      field: a.field,
      oldValue: a.oldValue,
      newValue: a.newValue,
      changedAt: a.changedAt,
      // Slim shape -- never send the full UserRow (password hash, admin
      // flag, invite token) over an API response just to show a name.
      changedBy: a.changedBy ? { id: a.changedBy.id, name: a.changedBy.name } : null,
    }))
  );
}
