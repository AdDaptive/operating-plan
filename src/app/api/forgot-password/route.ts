import { NextResponse } from "next/server";
import { getUserByEmail, regenerateInviteToken } from "@/lib/db";
import { sendAccountInviteEmail, sendPasswordResetEmail } from "@/lib/notifications";

/**
 * Public (no session) -- the "Forgot password?" flow. Always responds
 * with the same generic message regardless of whether the email matches
 * an account, so this can't be used to enumerate who has an account here.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { email } = body ?? {};

  if (!email) {
    return NextResponse.json({ error: "Enter your email address." }, { status: 400 });
  }

  const user = await getUserByEmail(String(email).toLowerCase().trim());
  if (user) {
    const { inviteToken, inviteTokenExpiresAt } = await regenerateInviteToken(user.id);
    const refreshed = { ...user, inviteToken, inviteTokenExpiresAt };
    // An account that never activated its invite doesn't have a password
    // to "reset" -- send the invite-flavored email (still the same link
    // mechanics) rather than a confusing "reset your password" for a
    // password that was never set.
    if (user.passwordHash) {
      await sendPasswordResetEmail(refreshed);
    } else {
      await sendAccountInviteEmail(refreshed, "Your admin");
    }
  }

  return NextResponse.json({
    message: "If an account exists for that email, we've sent a link to reset the password.",
  });
}
