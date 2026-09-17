import { format } from "date-fns";
import { getKeyResultById, getObjectiveById, getUserById, type TaskRow } from "@/lib/db";
import { STATUS_META } from "@/lib/status";
import { sendDigestEmail } from "@/lib/notifiers/email";
import { sendDigestSlackDM } from "@/lib/notifiers/slack";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Notifies a task's owner right away when a task is created and assigned
 * to them -- separate from, and in addition to, the daily digest, which
 * only tells them about it once, the next time the sweep runs, and only
 * if it's already overdue/due-soon/flagged by then. This fires over
 * whichever channels are configured (RESEND_API_KEY / SLACK_BOT_TOKEN),
 * same as the digest; with neither set it just logs what it would have
 * sent (see src/lib/notifiers/). Never throws -- a notification failure
 * should never fail the task-creation request itself.
 *
 * `creatorId`/`creatorName` are the signed-in person who created the
 * task; when they're also the task's owner (a self-assigned task), the
 * "assigned by" phrasing is left out rather than telling someone they
 * assigned a task to themselves.
 */
export async function notifyTaskAssigned(
  task: TaskRow,
  creator: { id?: string | null; name?: string | null }
): Promise<void> {
  try {
    const owner = await getUserById(task.ownerId);
    if (!owner) return;

    const keyResult = await getKeyResultById(task.keyResultId);
    const objective = keyResult ? await getObjectiveById(keyResult.objectiveId) : undefined;

    const dueLabel = format(new Date(task.dueDate), "MMM d, yyyy");
    const meta = STATUS_META[task.status];
    const where = [objective?.title, keyResult?.title].filter(Boolean).join(" / ");
    const assignedBy =
      creator.name && creator.id !== task.ownerId ? ` by ${creator.name}` : "";

    const subject = `New task assigned to you: ${task.title}`;

    const text =
      `You've been assigned a new task${assignedBy}:\n\n` +
      `${task.title}\n` +
      (where ? `${where}\n` : "") +
      `Due ${dueLabel} — ${meta.label}\n` +
      (task.description ? `\nDetails: ${task.description}\n` : "") +
      (task.notes ? `Notes: ${task.notes}\n` : "");

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EAECF0;border-radius:12px;padding:24px;">
      <p style="font-size:13px;color:#667085;margin:0 0 10px;">
        You've been assigned a new task${assignedBy ? escapeHtml(assignedBy) : ""}
      </p>
      <h2 style="font-size:16px;color:#101828;margin:0 0 6px;">${escapeHtml(task.title)}</h2>
      ${where ? `<p style="font-size:13px;color:#667085;margin:0 0 6px;">${escapeHtml(where)}</p>` : ""}
      <p style="font-size:13px;color:#475467;margin:0 0 10px;">
        Due ${dueLabel} —
        <span style="color:${meta.text};font-weight:600;">${meta.label}</span>
      </p>
      ${
        task.description
          ? `<p style="font-size:13px;color:#667085;margin:0 0 6px;">${escapeHtml(task.description)}</p>`
          : ""
      }
      ${
        task.notes
          ? `<p style="font-size:13px;color:#475467;font-style:italic;margin:0;">Notes: ${escapeHtml(task.notes)}</p>`
          : ""
      }
    </div>
  </body>
</html>`;

    await Promise.all([
      sendDigestEmail(owner.email, subject, html, text),
      sendDigestSlackDM(owner.email, text),
    ]);
  } catch (err) {
    console.error("[task-assigned notification] failed:", err);
  }
}
