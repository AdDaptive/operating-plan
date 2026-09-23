import { format } from "date-fns";
import {
  getKeyResultById,
  getObjectiveById,
  getUserById,
  type KeyResultRow,
  type MeetingAgendaRow,
  type TaskRow,
  type UserRow,
} from "@/lib/db";
import { STATUS_META } from "@/lib/status";
import { PRIORITY_META } from "@/lib/priority";
import type { AgendaKeyResultSection } from "@/lib/meetingAgenda";
import { sendDigestEmail } from "@/lib/notifiers/email";
import { sendDigestSlackDM } from "@/lib/notifiers/slack";
import type { SendResult } from "@/lib/notifiers/email";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Shared by notifyTaskAssigned for both the task's primary owner and an
 * optional delegated sub-owner -- the mechanics (build subject/text/html,
 * send email + Slack DM) are identical, only the framing sentence and
 * subject line differ ("assigned to you" vs. "delegated to you as a
 * sub-owner"). Never throws -- a notification failure should never fail
 * the task-creation request itself.
 */
async function notifyPersonAboutTask(
  task: TaskRow,
  recipient: UserRow,
  creator: { id?: string | null; name?: string | null },
  role: "owner" | "sub-owner"
): Promise<void> {
  try {
    const keyResult = await getKeyResultById(task.keyResultId);
    const objective = keyResult ? await getObjectiveById(keyResult.objectiveId) : undefined;

    const dueLabel = format(new Date(task.dueDate), "MMM d, yyyy");
    const meta = STATUS_META[task.status];
    const where = [objective?.title, keyResult?.title].filter(Boolean).join(" / ");
    const assignedBy =
      creator.name && creator.id !== recipient.id ? ` by ${creator.name}` : "";

    const intro =
      role === "owner"
        ? `You've been assigned a new task${assignedBy}`
        : `You've been delegated as a sub-owner on a new task${assignedBy}`;

    const subject =
      role === "owner"
        ? `New task assigned to you: ${task.title}`
        : `You've been added as a sub-owner: ${task.title}`;

    const text =
      `${intro}:\n\n` +
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
        ${escapeHtml(intro)}
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
      sendDigestEmail(recipient.email, subject, html, text),
      sendDigestSlackDM(recipient.email, text),
    ]);
  } catch (err) {
    console.error(`[task-assigned notification] failed (${role}):`, err);
  }
}

/**
 * Notifies a task's owner right away when a task is created and assigned
 * to them -- separate from, and in addition to, the daily digest, which
 * only tells them about it once, the next time the sweep runs, and only
 * if it's already overdue/due-soon/flagged by then. This fires over
 * whichever channels are configured (SMTP_HOST/SMTP_USER/SMTP_PASS / SLACK_BOT_TOKEN),
 * same as the digest; with neither set it just logs what it would have
 * sent (see src/lib/notifiers/). Never throws -- a notification failure
 * should never fail the task-creation request itself.
 *
 * `creatorId`/`creatorName` are the signed-in person who created the
 * task; when they're also the task's owner (a self-assigned task), the
 * "assigned by" phrasing is left out rather than telling someone they
 * assigned a task to themselves.
 *
 * When the task also has a delegated sub-owner (`task.subOwnerId`, distinct
 * from the owner), that person gets the same treatment -- full parity,
 * same channels, same immediate timing -- with role-appropriate wording.
 * Like the owner notification, this only fires at task-creation time, not
 * on a later edit that adds or changes a sub-owner (matching the existing
 * convention documented on notifyKeyResultAssigned below).
 */
export async function notifyTaskAssigned(
  task: TaskRow,
  creator: { id?: string | null; name?: string | null }
): Promise<void> {
  const owner = await getUserById(task.ownerId);
  if (owner) {
    await notifyPersonAboutTask(task, owner, creator, "owner");
  }

  if (task.subOwnerId && task.subOwnerId !== task.ownerId) {
    const subOwner = await getUserById(task.subOwnerId);
    if (subOwner) {
      await notifyPersonAboutTask(task, subOwner, creator, "sub-owner");
    }
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
/**
 * Emails every attendee of a just-created meeting agenda (see POST
 * /api/meeting-agendas) a summary plus a link to the live /agenda/[id]
 * page. Sent once per attendee so each email is personally addressed;
 * the content itself isn't personalized beyond that -- every attendee
 * sees the same agenda. Never throws, same failure-isolation convention
 * as every other notifier here -- a broken/misconfigured SMTP setup
 * should never fail the agenda-creation request itself.
 */
export async function sendMeetingAgendaEmail(
  agenda: MeetingAgendaRow,
  attendees: UserRow[],
  sections: AgendaKeyResultSection[]
): Promise<void> {
  try {
    const dateLabel = format(new Date(agenda.meetingDate), "EEEE, MMMM d, yyyy");
    const agendaUrl = `${baseUrl()}/agenda/${agenda.id}`;
    const subject = `Meeting agenda: ${dateLabel}`;
    const attendeeNames = attendees.map((a) => a.name).join(", ");

    const textSections = sections.length
      ? sections
          .map((s) => {
            const lines = s.tasks.length
              ? s.tasks
                  .map((t) => {
                    const dueLabel = format(new Date(t.dueDate), "MMM d, yyyy");
                    const priorityLabel = t.priority ? `, ${PRIORITY_META[t.priority].label}` : "";
                    return `  - ${t.title} (${t.owner.name}, due ${dueLabel}, ${STATUS_META[t.status].label}${priorityLabel})`;
                  })
                  .join("\n")
              : "  (no matching tasks yet)";
            return `${s.objectiveTitle} / ${s.keyResultTitle}
${lines}`;
          })
          .join("\n\n")
      : "(nothing to review yet for the selected attendees)";

    const text =
      `Meeting agenda for ${dateLabel}

` +
      `Attendees: ${attendeeNames}

` +
      `${textSections}

` +
      `View the full, up-to-date agenda: ${agendaUrl}`;

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EAECF0;border-radius:12px;padding:24px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:0.04em;color:#98A2B3;margin:0 0 4px;">MEETING AGENDA</p>
      <h2 style="font-size:18px;margin:0 0 10px;">${escapeHtml(dateLabel)}</h2>
      <p style="font-size:13px;color:#667085;margin:0 0 18px;">Attendees: ${escapeHtml(attendeeNames)}</p>
      <a href="${agendaUrl}" style="display:inline-block;background:#3538CD;color:#fff;font-size:14px;font-weight:600;padding:10px 18px;border-radius:8px;text-decoration:none;">
        View full agenda
      </a>
      <p style="font-size:12px;color:#98A2B3;margin:18px 0 0;">This link always shows the latest data, right up to the meeting.</p>
    </div>
  </body>
</html>`;

    await Promise.all(attendees.map((a) => sendDigestEmail(a.email, subject, html, text)));
  } catch (err) {
    console.error("[meeting-agenda email] failed:", err);
  }
}
