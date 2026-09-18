import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByInviteToken, activateUser } from "@/lib/db";

/** Public (no session) -- claims an invite token by setting a password, the other half of /api/admin/invite. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { token, password } = body ?? {};

  if (!token || !password) {
    return NextResponse.json({ error: "Missing invite token or password." }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const user = await getUserByInviteToken(String(token));
  if (!user) {
    return NextResponse.json(
      { error: "This invite link is invalid or has already been used." },
      { status: 404 }
    );
  }
  if (user.inviteTokenExpiresAt && new Date(user.inviteTokenExpiresAt).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This invite link has expired. Ask your admin to resend it." },
      { status: 410 }
    );
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  await activateUser(user.id, passwordHash);

  return NextResponse.json({ email: user.email, name: user.name });
}
