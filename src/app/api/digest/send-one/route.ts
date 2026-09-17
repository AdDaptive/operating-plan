import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendDigestToUser } from "@/lib/digest";

/**
 * Manual, single-person trigger -- the "Send" button next to someone on
 * the Team page. Requires a signed-in session (same as the bulk "Send
 * digest to everyone" button); any signed-in person can trigger a send to
 * any other person, same as they can already see everyone's task counts on
 * that page.
 *
 * Always uses `force: true` (see sendDigestToUser) so this actually sends
 * -- or reports there's nothing to send -- even if that person already
 * got today's automatic digest; a deliberate one-person click shouldn't
 * silently no-op because of the daily dedup meant for the automatic sweep.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : null;
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const result = await sendDigestToUser(userId, { force: true });
  if (!result) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ result });
}
