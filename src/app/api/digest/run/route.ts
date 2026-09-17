import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { runDailyDigest } from "@/lib/digest";

// Manual trigger from the UI's "Send daily digest now" button — requires a
// signed-in session, same as any other page action.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDailyDigest();
  return NextResponse.json({ sent: results.length, results });
}

// Scheduled trigger — Vercel Cron Jobs (see vercel.json) call this with GET
// and an `Authorization: Bearer $CRON_SECRET` header, not a browser session.
// Set CRON_SECRET in your environment variables to enable this; without it,
// this endpoint refuses all GET requests so a stranger can't trigger sends.
// (Netlify Scheduled Functions or any other cron can call this the same
// way — just send that same header.)
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 501 }
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runDailyDigest();
  return NextResponse.json({ sent: results.length, results });
}
