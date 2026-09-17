import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import {
  listActiveTasksForReminders,
  listUsers,
  findDigestSentToday,
  createDigestLog,
  type TaskForReminder,
  type UserRow,
} from "@/lib/db";
import { STATUS_META } from "@/lib/status";
import { sendDigestEmail } from "@/lib/notifiers/email";
import { sendDigestSlackDM } from "@/lib/notifiers/slack";

/** Tasks due this many days out (inclusive) count as "due soon". */
const UPCOMING_WINDOW_DAYS = 3;

type TaskBucket = {
  overdue: TaskForReminder[];
  dueToday: TaskForReminder[];
  dueSoon: TaskForReminder[];
  /** AT_RISK / OFF_TRACK tasks that aren't already overdue/due soon. */
  flagged: TaskForReminder[];
};

function bucketTasks(tasks: TaskForReminder[]): TaskBucket {
  const today = startOfDay(new Date());
  const bucket: TaskBucket = { overdue: [], dueToday: [], dueSoon: [], flagged: [] };
  for (const t of tasks) {
    const days = differenceInCalendarDays(startOfDay(new Date(t.dueDate)), today);
    if (days < 0) bucket.overdue.push(t);
    else if (days === 0) bucket.dueToday.push(t);
    else if (days <= UPCOMING_WINDOW_DAYS) bucket.dueSoon.push(t);
    else if (t.status === "AT_RISK" || t.status === "OFF_TRACK") bucket.flagged.push(t);
  }
  return bucket;
}

function isTeamFlag(t: TaskForReminder): boolean {
  const days = differenceInCalendarDays(startOfDay(new Date(t.dueDate)), startOfDay(new Date()));
  return days < 0 || t.status === "AT_RISK" || t.status === "OFF_TRACK";
}

type DigestContent = {
  subject: string;
  text: string;
  html: string;
  ownItemCount: number;
  teamFlagCount: number;
};

/** Everything needed to render or send one person's digest, computed once. */
function computeDigestContent(user: UserRow, tasks: TaskForReminder[], users: UserRow[]): DigestContent {
  const ownTasks = tasks.filter((t) => t.ownerId === user.id);
  const bucket = bucketTasks(ownTasks);
  const ownItemCount =
    bucket.overdue.length + bucket.dueToday.length + bucket.dueSoon.length + bucket.flagged.length;

  const reportIds = new Set(users.filter((u) => u.managerId === user.id).map((u) => u.id));
  const teamFlags = reportIds.size
    ? tasks.filter((t) => reportIds.has(t.ownerId) && isTeamFlag(t))
    : [];

  const { subject, text, html } = buildDigestMessage(user, bucket, teamFlags);
  return { subject, text, html, ownItemCount, teamFlagCount: teamFlags.length };
}

export type DigestSendResult = {
  recipientEmail: string;
  recipientName: string;
  emailSent: boolean;
  slackSent: boolean;
  ownItemCount: number;
  teamFlagCount: number;
};

/**
 * Builds and (unless there's nothing worth telling them) sends one
 * person's daily status digest -- their own overdue / due-today /
 * due-soon / at-risk tasks, plus, if they manage anyone, a short rollup of
 * their direct reports' overdue or at-risk items.
 *
 * Sends over whichever channels are configured (RESEND_API_KEY for email,
 * SLACK_BOT_TOKEN for Slack -- see src/lib/notifiers/). Either, both, or
 * neither can be set; with neither set this still "sends" (logs what it
 * would have sent) so the digest content itself can be exercised.
 *
 * Idempotent per person per channel per day (digest_logs table) unless
 * `force` is set -- pass `force: true` for an explicit one-person send
 * (the "Send" button next to someone on the Team page), where a person
 * deliberately asking for a resend should get one even if the automatic
 * daily sweep already ran for them today. Pass `tasks`/`users` to reuse
 * data a caller already fetched for many people at once (see
 * runDailyDigest) instead of re-querying per user.
 */
export async function sendDigestToUser(
  userId: string,
  opts?: { force?: boolean; tasks?: TaskForReminder[]; users?: UserRow[] }
): Promise<DigestSendResult | null> {
  const tasks = opts?.tasks ?? (await listActiveTasksForReminders());
  const users = opts?.users ?? (await listUsers());
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  const content = computeDigestContent(user, tasks, users);

  if (content.ownItemCount === 0 && content.teamFlagCount === 0) {
    return {
      recipientEmail: user.email,
      recipientName: user.name,
      emailSent: false,
      slackSent: false,
      ownItemCount: 0,
      teamFlagCount: 0,
    };
  }

  let emailSent = false;
  let slackSent = false;

  const alreadyEmailed = !opts?.force && (await findDigestSentToday(user.email, "email"));
  if (!alreadyEmailed) {
    const r = await sendDigestEmail(user.email, content.subject, content.html, content.text);
    emailSent = r.sent;
    if (r.sent) await createDigestLog({ recipientEmail: user.email, channel: "email" });
  }

  const alreadySlacked = !opts?.force && (await findDigestSentToday(user.email, "slack"));
  if (!alreadySlacked) {
    const r = await sendDigestSlackDM(user.email, content.text);
    slackSent = r.sent;
    if (r.sent) await createDigestLog({ recipientEmail: user.email, channel: "slack" });
  }

  return {
    recipientEmail: user.email,
    recipientName: user.name,
    emailSent,
    slackSent,
    ownItemCount: content.ownItemCount,
    teamFlagCount: content.teamFlagCount,
  };
}

/**
 * Sends the daily digest to every person who has something worth telling
 * them about. Used by the "Send digest to everyone" button (Team page) and
 * the daily cron (see api/digest/run/route.ts). Uses the per-person/
 * per-channel daily dedup in sendDigestToUser (no `force`), since this is
 * the automatic sweep and shouldn't double-send if triggered twice in a
 * day (the button, then the cron).
 */
export async function runDailyDigest(): Promise<DigestSendResult[]> {
  const [tasks, users] = await Promise.all([listActiveTasksForReminders(), listUsers()]);
  const results: DigestSendResult[] = [];

  for (const user of users) {
    const result = await sendDigestToUser(user.id, { tasks, users });
    if (result && (result.ownItemCount > 0 || result.teamFlagCount > 0)) {
      results.push(result);
    }
  }

  return results;
}

export type DigestPreview = {
  user: UserRow;
  subject: string;
  html: string;
  text: string;
  ownItemCount: number;
  teamFlagCount: number;
};

/**
 * Builds (but never sends, and never touches digest_logs) the digest
 * content for one user -- what the "Preview" link next to someone on the
 * Team page renders for that person. Lets you see exactly what the
 * email/Slack message would look like without RESEND_API_KEY or
 * SLACK_BOT_TOKEN configured yet, and without it counting as an actual
 * send for today.
 */
export async function buildDigestPreviewForUser(userId: string): Promise<DigestPreview | null> {
  const [tasks, users] = await Promise.all([listActiveTasksForReminders(), listUsers()]);
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  const content = computeDigestContent(user, tasks, users);
  return { user, ...content };
}

function dueLabel(t: TaskForReminder): string {
  return format(new Date(t.dueDate), "MMM d");
}

function taskLine(t: TaskForReminder, withOwner = false): string {
  const owner = withOwner ? `${t.owner.name}: ` : "";
  return `${owner}${t.title} (${t.objectiveTitle} / ${t.keyResultTitle}) — due ${dueLabel(t)} — ${STATUS_META[t.status].label}`;
}

function section(title: string, tasks: TaskForReminder[], withOwner = false): string {
  if (tasks.length === 0) return "";
  return `${title} (${tasks.length}):\n${tasks.map((t) => `  • ${taskLine(t, withOwner)}`).join("\n")}`;
}

function buildDigestMessage(
  user: UserRow,
  bucket: TaskBucket,
  teamFlags: TaskForReminder[]
): { subject: string; text: string; html: string } {
  const textSections = [
    section("Overdue", bucket.overdue),
    section("Due today", bucket.dueToday),
    section(`Due in the next ${UPCOMING_WINDOW_DAYS} days`, bucket.dueSoon),
    section("Flagged at risk / off track", bucket.flagged),
    section("Your team needs attention on", teamFlags, true),
  ].filter(Boolean);

  const text =
    `Good morning ${user.name},\n\nHere's your AdDaptive OS status for ${format(new Date(), "MMM d, yyyy")}:\n\n` +
    textSections.join("\n\n") +
    "\n";

  const subject =
    bucket.overdue.length > 0
      ? `AdDaptive OS: ${bucket.overdue.length} overdue task${bucket.overdue.length === 1 ? "" : "s"} — daily status`
      : `AdDaptive OS — daily status for ${format(new Date(), "MMM d")}`;

  const html = buildHtml(user, bucket, teamFlags);

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function htmlRow(t: TaskForReminder, withOwner: boolean): string {
  const meta = STATUS_META[t.status];
  const owner = withOwner ? `<strong>${escapeHtml(t.owner.name)}:</strong> ` : "";
  return `
    <tr>
      <td style="padding:6px 0;border-bottom:1px solid #F2F4F7;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${meta.dot};margin-right:8px;"></span>
        ${owner}${escapeHtml(t.title)}
        <div style="margin-left:16px;color:#667085;font-size:12px;">
          ${escapeHtml(t.objectiveTitle)} / ${escapeHtml(t.keyResultTitle)} — due ${dueLabel(t)} —
          <span style="color:${meta.text};font-weight:600;">${meta.label}</span>
        </div>
      </td>
    </tr>`;
}

function htmlSection(title: string, tasks: TaskForReminder[], withOwner = false): string {
  if (tasks.length === 0) return "";
  return `
    <h3 style="font-size:13px;color:#344054;margin:20px 0 6px;">${title} (${tasks.length})</h3>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#101828;">
      ${tasks.map((t) => htmlRow(t, withOwner)).join("")}
    </table>`;
}

function buildHtml(user: UserRow, bucket: TaskBucket, teamFlags: TaskForReminder[]): string {
  const body = [
    htmlSection("Overdue", bucket.overdue),
    htmlSection("Due today", bucket.dueToday),
    htmlSection(`Due in the next ${UPCOMING_WINDOW_DAYS} days`, bucket.dueSoon),
    htmlSection("Flagged at risk / off track", bucket.flagged),
    htmlSection("Your team needs attention on", teamFlags, true),
  ].join("");

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EAECF0;border-radius:12px;padding:24px;">
      <p style="font-size:15px;color:#101828;margin:0 0 4px;">Good morning ${escapeHtml(user.name)},</p>
      <p style="font-size:13px;color:#667085;margin:0 0 8px;">
        Your AdDaptive OS status for ${format(new Date(), "MMM d, yyyy")}
      </p>
      ${body}
    </div>
  </body>
</html>`;
}
