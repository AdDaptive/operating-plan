import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getUserByInviteToken, setUserPassword } from "@/lib/db";

/**
 * Public (no session) -- claims a token by setting a password. Backs both
 * /activate (first-time invite claim) and /reset-password (forgot
 * password): both send a person here with { token, password }, and this
 * route doesn't need to know or care which one issued the token.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { token, password } = body ?? {};

  if (!token || !password) {
    return NextResponse.json({ error: "Missing token or password." }, { status: 400 });
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
      { error: "This link is invalid or has already been used." },
      { status: 404 }
    );
  }
  if (user.inviteTokenExpiresAt && new Date(user.inviteTokenExpiresAt).getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This link has expired. Request a new one." },
      { status: 410 }
    );
  }

  const passwordHash = await bcrypt.hash(String(password), 10);
  await setUserPassword(user.id, passwordHash);

  return NextResponse.json({ email: user.email, name: user.name });
}
