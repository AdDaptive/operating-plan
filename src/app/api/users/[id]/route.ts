import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, updateUser, type PermissionLevel } from "@/lib/db";
import { LEVEL_ORDER } from "@/lib/permissions";

/**
 * Admin-only: changes who a person reports to (Team page "Reports to"
 * dropdown) and/or their own visibility level (Team page "Level"
 * dropdown -- see PermissionLevel in db.ts). Only `managerId` and `level`
 * are accepted -- name/email/isAdmin still have no edit UI anywhere in
 * this app; see updateUser's doc comment in db.ts. Admin-gated the same
 * way POST /api/admin/invite and the resend-invite route are, since both
 * of these are account-structure changes, not an everyday edit like a
 * task or objective (which any signed-in person can already make -- see
 * the build notes for that existing convention). Either field can be sent
 * alone or together; whichever is present in the body is what gets
 * applied (mergeDefined in db.ts leaves the other alone).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requester = await getUserById(sessionUserId);
  if (!requester?.isAdmin) {
    return NextResponse.json({ error: "Only an admin can change someone's manager or level." }, { status: 403 });
  }

  const target = await getUserById(params.id);
  if (!target) {
    return NextResponse.json({ error: "That account doesn't exist." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || (!("managerId" in body) && !("level" in body))) {
    return NextResponse.json(
      { error: "managerId (or null to clear it) and/or level is required." },
      { status: 400 }
    );
  }

  const patch: { managerId?: string | null; level?: PermissionLevel } = {};

  if ("managerId" in body) {
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
    patch.managerId = resolvedManagerId;
  }

  if ("level" in body) {
    const { level } = body as { level: PermissionLevel };
    if (!LEVEL_ORDER.includes(level)) {
      return NextResponse.json({ error: "Not a valid level." }, { status: 400 });
    }
    patch.level = level;
  }

  const updated = await updateUser(target.id, patch);
  return NextResponse.json({
    id: updated!.id,
    name: updated!.name,
    managerId: updated!.managerId,
    level: updated!.level,
  });
}
