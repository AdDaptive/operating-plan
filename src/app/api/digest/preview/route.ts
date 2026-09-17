import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildDigestPreviewForUser } from "@/lib/digest";

/**
 * Renders the digest exactly as it would be emailed/Slacked to the
 * signed-in user -- but never sends anything and never touches
 * digest_logs, so it's safe to open as many times as you like while
 * checking the content, even before RESEND_API_KEY / SLACK_BOT_TOKEN are
 * configured.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preview = await buildDigestPreviewForUser(userId);
  if (!preview) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (preview.ownItemCount === 0 && preview.teamFlagCount === 0) {
    return new NextResponse(
      `<!doctype html>
<html>
  <body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475467;">
    <p style="max-width:480px;">You wouldn't get a digest today — nothing of yours is overdue, due
    today, due in the next few days, or flagged at risk/off track, and (if you manage anyone)
    nothing on your team is either.</p>
    <p style="max-width:480px;">To see what a real digest looks like, try setting a task's due date
    to a past date, or its status to At Risk / Off Track, then reload this page.</p>
  </body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(preview.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
