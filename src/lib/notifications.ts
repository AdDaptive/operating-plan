import { format } from "date-fns";
import {
  getKeyResultById,
  getObjectiveById,
  getUserById,
  type KeyResultRow,
  type TaskRow,
  type UserRow,
} from "@/lib/db";
import { STATUS_META } from "@/lib/status";
import { sendDigestEmail } from "@/lib/notifiers/email";
import { sendDigestSlackDM } from "@/lib/notifiers/slack";
import type { SendResult } from "@/lib/notifiers/email";

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


/**
 * Same idea as notifyTaskAssigned, for key results: notifies the key
 * result's owner right away when one is created with an owner already
 * set. A key result's owner is optional (nullable) and most are created
 * unassigned, so this is a no-op whenever `keyResult.ownerId` is null --
 * there's deliberately no "assigned later via edit" notification yet,
 * only at creation time, matching what was asked for.
 */
export async function notifyKeyResultAssigned(
  keyResult: KeyResultRow,
  creator: { id?: string | null; name?: string | null }
): Promise<void> {
  if (!keyResult.ownerId) return;

  try {
    const owner = await getUserById(keyResult.ownerId);
    if (!owner) return;

    const objective = await getObjectiveById(keyResult.objectiveId);
    const assignedBy =
      creator.name && creator.id !== keyResult.ownerId ? ` by ${creator.name}` : "";

    const subject = `New key result assigned to you: ${keyResult.title}`;

    const text =
      `You've been assigned a new key result${assignedBy}:\n\n` +
      `${keyResult.title}\n` +
      (objective ? `${objective.title}\n` : "") +
      (keyResult.dueDate ? `Due ${format(new Date(keyResult.dueDate), "MMM d, yyyy")}\n` : "");

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EAECF0;border-radius:12px;padding:24px;">
      <p style="font-size:13px;color:#667085;margin:0 0 10px;">
        You've been assigned a new key result${assignedBy ? escapeHtml(assignedBy) : ""}
      </p>
      <h2 style="font-size:16px;color:#101828;margin:0 0 6px;">${escapeHtml(keyResult.title)}</h2>
      ${objective ? `<p style="font-size:13px;color:#667085;margin:0 0 6px;">${escapeHtml(objective.title)}</p>` : ""}
      ${
        keyResult.dueDate
          ? `<p style="font-size:13px;color:#475467;margin:0;">Due ${format(new Date(keyResult.dueDate), "MMM d, yyyy")}</p>`
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
    console.error("[key-result-assigned notification] failed:", err);
  }
}

/**
 * Base URL for links in outbound emails (the activation link below, and
 * anywhere else one gets added later). NEXTAUTH_URL is already required
 * for NextAuth itself in production (see README), so this reuses it
 * rather than introducing a second env var; falls back to localhost for
 * local dev where NEXTAUTH_URL is often left unset.
 */
function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

/**
 * Shared by sendAccountInviteEmail and sendPasswordResetEmail below -- the
 * two emails are the same mechanics (a link to /api/set-password's front
 * end with a token, expiring in 7 days) and differ only in subject/copy
 * and which page the link points at. Email-only, deliberately -- unlike
 * the digest/assignment notifications, there's no Slack DM attempt here:
 * `sendDigestSlackDM` looks someone up by email in the workspace, and
 * someone mid-invite or mid-reset may not resolve to anything meaningful
 * over Slack (a brand-new invitee almost certainly won't). Returns the
 * send result (rather than swallowing it like the other notifiers here)
 * because the admin-facing UI shows whether it actually went out.
 */
async function sendPasswordSetEmail(
  user: UserRow,
  opts: { page: "activate" | "reset-password"; subject: string; intro: string; cta: string }
): Promise<SendResult> {
  if (!user.inviteToken) {
    return { sent: false, reason: "no pending token set on this account" };
  }

  const setPasswordUrl = `${baseUrl()}/${opts.page}?token=${user.inviteToken}`;

  const text =
    `${opts.intro}\n\n` +
    `${opts.cta}:\n${setPasswordUrl}\n\n` +
    `This link expires in 7 days.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EAECF0;border-radius:12px;padding:24px;">
      <p style="font-size:13px;color:#667085;margin:0 0 18px;">
        ${escapeHtml(opts.intro)}
      </p>
      <a href="${setPasswordUrl}" style="display:inline-block;background:#3538CD;color:#fff;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;">
        ${escapeHtml(opts.cta)}
      </a>
      <p style="font-size:12px;color:#98A2B3;margin:18px 0 0;">This link expires in 7 days.</p>
    </div>
  </body>
</html>`;

  return sendDigestEmail(user.email, opts.subject, html, text);
}

/**
 * Emails an admin-invited person their activation link (see POST
 * /api/admin/invite and the "Resend invite" action on the Team page).
 */
export async function sendAccountInviteEmail(
  invitee: UserRow,
  inviterName: string
): Promise<SendResult> {
  return sendPasswordSetEmail(invitee, {
    page: "activate",
    subject: "You've been added to AdDaptive OS",
    intro: `${inviterName} added you to AdDaptive OS. Set your password to finish setting up your account.`,
    cta: "Set your password",
  });
}

/**
 * Emails a password-reset link (see POST /api/forgot-password). Called
 * with a user row that already has a freshly regenerated `inviteToken` on
 * it (via regenerateInviteToken) -- the same token field used for
 * invites, since the two flows are mechanically identical (see
 * setUserPassword's doc comment in src/lib/db.ts).
 */
export async function sendPasswordResetEmail(user: UserRow): Promise<SendResult> {
  return sendPasswordSetEmail(user, {
    page: "reset-password",
    subject: "Reset your AdDaptive OS password",
    intro: "Someone (hopefully you) requested a password reset for your AdDaptive OS account.",
    cta: "Reset your password",
  });
}
