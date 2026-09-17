/**
 * Run this on a schedule (cron, a serverless scheduled function, GitHub
 * Actions, etc.) to sweep for tasks due in 3 days or 1 day and log/"send"
 * reminders to the owner and their manager.
 *
 *   npm run reminders
 */
import { runReminderSweep } from "../src/lib/reminders";
import { closePool } from "../src/lib/db";

async function main() {
  const results = await runReminderSweep();
  if (results.length === 0) {
    console.log("No reminders due right now.");
  } else {
    console.log(`Sent ${results.length} reminder(s).`);
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
