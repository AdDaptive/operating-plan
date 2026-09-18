import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getUserById, regenerateInviteToken } from "@/lib/db";
import { sendAccountInviteEmail } from "@/lib/notifications";

/** Re-issues an invite token/link for a still-pending account and re-emails it (Team page "Resend invite"). */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requester = await getUserById(sessionUserId);
  if (!requester?.isAdmin) {
    return NextResponse.json({ error: "Only an admin can resend invites." }, { status: 403 });
  }

  const target = await getUserById(params.id);
  if (!target) {
    return NextResponse.json({ error: "That account doesn't exist." }, { status: 404 });
  }
  if (target.passwordHash) {
    return NextResponse.json(
      { error: "That account has already been activated." },
      { status: 409 }
    );
  }

  const { inviteToken, inviteTokenExpiresAt } = await regenerateInviteToken(target.id);
  const result = await sendAccountInviteEmail(
    { ...target, inviteToken, inviteTokenExpiresAt },
    requester.name
  );

  return NextResponse.json({ emailSent: result.sent });
}
