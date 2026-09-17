/**
 * Run this on a schedule (cron, a serverless scheduled function, GitHub
 * Actions, etc.) to send everyone their daily status digest -- their own
 * overdue / due-today / due-soon / at-risk tasks, plus a team rollup for
 * anyone who manages others. Sends over email (Resend, via RESEND_API_KEY)
 * and/or Slack (via SLACK_BOT_TOKEN) -- see src/lib/notifiers/.
 *
 *   npm run digest
 */
import { runDailyDigest } from "../src/lib/digest";
import { closePool } from "../src/lib/db";

async function main() {
  const results = await runDailyDigest();
  if (results.length === 0) {
    console.log("Nobody has anything overdue, due soon, or flagged right now.");
  } else {
    console.log(`Sent today's digest to ${results.length} ${results.length === 1 ? "person" : "people"}:`);
    for (const r of results) {
      console.log(
        `  - ${r.recipientName} <${r.recipientEmail}>: ${r.ownItemCount} own item(s), ${r.teamFlagCount} team flag(s) — email ${r.emailSent ? "sent" : "skipped"}, Slack ${r.slackSent ? "sent" : "skipped"}`
      );
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
