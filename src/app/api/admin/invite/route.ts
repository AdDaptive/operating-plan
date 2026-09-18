import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, getUserByEmail, createInvitedUser } from "@/lib/db";
import { sendAccountInviteEmail } from "@/lib/notifications";

/**
 * Creates a new account and emails the person an /activate link -- the
 * only way an account can come into existence now that public /signup is
 * gone. Admin-only: "restrict access, only allow those I say are ok"
 * means account creation itself has to be gated, not just login.
 */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requester = await getUserById(sessionUserId);
  if (!requester?.isAdmin) {
    return NextResponse.json({ error: "Only an admin can invite new accounts." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { name, email, managerId, isAdmin } = body ?? {};

  if (!name || !email) {
    return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const existing = await getUserByEmail(normalizedEmail);
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 }
    );
  }

  let resolvedManagerId: string | null = null;
  if (managerId) {
    const manager = await getUserById(String(managerId));
    if (!manager) {
      return NextResponse.json({ error: "That manager doesn't exist." }, { status: 400 });
    }
    resolvedManagerId = manager.id;
  }

  const user = await createInvitedUser({
    name: String(name).trim(),
    email: normalizedEmail,
    managerId: resolvedManagerId,
    isAdmin: Boolean(isAdmin),
  });

  const result = await sendAccountInviteEmail(user, requester.name);

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    emailSent: result.sent,
  });
}
