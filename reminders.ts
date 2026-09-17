import { differenceInCalendarDays, startOfDay } from "date-fns";
import { listActiveTasksForReminders, findReminderSentToday, createReminderLog } from "@/lib/db";

/**
 * STUBBED reminder sender.
 *
 * This does the real work of deciding *who* should be reminded and *when*
 * (owner + owner's manager, at 3 days and 1 day before the due date), and
 * records that a reminder went out in the reminder_logs table. It does not
 * actually send an email yet -- swap the console.log below for a call to
 * a real provider (Resend, SendGrid, Postmark, your Microsoft 365 SMTP,
 * etc.) when you're ready to wire that up.
 */

export type ReminderResult = {
  taskId: string;
  taskTitle: string;
  daysBeforeDue: number;
  recipients: { role: "owner" | "manager"; name: string; email: string }[];
};

export async function runReminderSweep(): Promise<ReminderResult[]> {
  const tasks = await listActiveTasksForReminders();
  const today = startOfDay(new Date());
  const results: ReminderResult[] = [];

  for (const task of tasks) {
    const due = startOfDay(new Date(task.dueDate));
    const daysUntilDue = differenceInCalendarDays(due, today);
    if (daysUntilDue !== 3 && daysUntilDue !== 1) continue;

    const alreadySentToday = await findReminderSentToday(task.id, daysUntilDue);
    if (alreadySentToday) continue;

    const recipients: { role: "owner" | "manager"; name: string; email: string }[] = [
      { role: "owner", name: task.owner.name, email: task.owner.email },
    ];
    if (task.manager) {
      recipients.push({ role: "manager", name: task.manager.name, email: task.manager.email });
    }

    for (const recipient of recipients) {
      await createReminderLog({
        taskId: task.id,
        recipientRole: recipient.role,
        recipientEmail: recipient.email,
        daysBeforeDue: daysUntilDue,
      });

      // --- stubbed send: replace with a real email call ---
      console.log(
        `[reminder] would email ${recipient.name} <${recipient.email}> (${recipient.role}): ` +
          `"${task.title}" (${task.objectiveTitle}) is due in ${daysUntilDue} day(s).`
      );
    }

    results.push({
      taskId: task.id,
      taskTitle: task.title,
      daysBeforeDue: daysUntilDue,
      recipients,
    });
  }

  return results;
}
