import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, updateUser } from "@/lib/db";

/**
 * Admin-only: changes who a person reports to (Team page "Reports to"
 * dropdown). Only `managerId` is accepted -- name/email/isAdmin still have
 * no edit UI anywhere in this app; see updateUser's doc comment in db.ts.
 * Admin-gated the same way POST /api/admin/invite and the resend-invite
 * route are, since this is a reporting-structure change, not an
 * everyday edit like a task or objective (which any signed-in person can
 * already make -- see the build notes for that existing convention).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requester = await getUserById(sessionUserId);
  if (!requester?.isAdmin) {
    return NextResponse.json({ error: "Only an admin can change someone's manager." }, { status: 403 });
  }

  const target = await getUserById(params.id);
  if (!target) {
    return NextResponse.json({ error: "That account doesn't exist." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !("managerId" in body)) {
    return NextResponse.json({ error: "managerId is required (or null to clear it)." }, { status: 400 });
  }
  const { managerId } = body as { managerId: string | null };

  let resolvedManagerId: string | null = null;
  if (managerId) {
    if (managerId === target.id) {
      return NextResponse.json({ error: "Someone can't be their own manager." }, { status: 400 });
    }
    const manager = await getUserById(String(managerId));
    if (!manager) {
      return NextResponse.json({ error: "That manager doesn't exist." }, { status: 400 });
    }
    resolvedManagerId = manager.id;
  }

  const updated = await updateUser(target.id, { managerId: resolvedManagerId });
  return NextResponse.json({
    id: updated!.id,
    name: updated!.name,
    managerId: updated!.managerId,
  });
}
