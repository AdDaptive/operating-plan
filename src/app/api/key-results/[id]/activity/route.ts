import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listKeyResultActivityForKeyResult, getKeyResultCreationInfo } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activity, creation] = await Promise.all([
    listKeyResultActivityForKeyResult(params.id),
    getKeyResultCreationInfo(params.id),
  ]);
  return NextResponse.json({
    createdAt: creation?.createdAt ?? null,
    createdBy: creation?.createdBy ? { id: creation.createdBy.id, name: creation.createdBy.name } : null,
    entries: activity.map((a) => ({
      id: a.id,
      field: a.field,
      oldValue: a.oldValue,
      newValue: a.newValue,
      changedAt: a.changedAt,
      // Slim shape -- never send the full UserRow over an API response.
      changedBy: a.changedBy ? { id: a.changedBy.id, name: a.changedBy.name } : null,
    })),
  });
}
