import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { buildDigestPreviewForUser } from "@/lib/digest";

/**
 * Renders the digest exactly as it would be emailed/Slacked to a person --
 * but never sends anything and never touches digest_logs, so it's safe to
 * open as many times as you like while checking the content, even before
 * SMTP_HOST/SMTP_USER/SMTP_PASS / SLACK_BOT_TOKEN are configured.
 *
 * Defaults to the signed-in user's own digest; pass ?userId=<id> (as the
 * "Preview" link next to each person on the Team page does) to preview
 * anyone else's -- any signed-in person can preview anyone's digest, same
 * as they can already see everyone's task counts on the Team page.
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
  if (!session || !sessionUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const requestedUserId = request.nextUrl.searchParams.get("userId");
  const userId = requestedUserId || sessionUserId;

  const preview = await buildDigestPreviewForUser(userId);
  if (!preview) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (preview.ownItemCount === 0 && preview.teamFlagCount === 0) {
    return new NextResponse(
      `<!doctype html>
<html>
  <body style="margin:0;padding:40px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#475467;">
    <p style="max-width:480px;">${preview.user.name} wouldn't get a digest today — they don't own
    any active tasks right now, and (if they manage anyone) nothing on their team is
    overdue or flagged at risk either.</p>
    <p style="max-width:480px;">To see what a real digest looks like, try assigning them a task
    with a due date, then reload this page.</p>
  </body>
</html>`,
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  return new NextResponse(preview.html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
