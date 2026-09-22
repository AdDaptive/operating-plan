import { format } from "date-fns";
import {
  listActiveTasksForReminders,
  listUsers,
  findDigestSentToday,
  createDigestLog,
  type TaskForReminder,
  type UserRow,
} from "@/lib/db";
import { STATUS_META, isOverdue } from "@/lib/status";
import { bucketTasks, isTeamFlag } from "@/lib/taskBuckets";
import { sendDigestEmail } from "@/lib/notifiers/email";
import { sendDigestSlackDM } from "@/lib/notifiers/slack";

type DigestContent = {
  subject: string;
  text: string;
  html: string;
  ownItemCount: number;
  teamFlagCount: number;
};

/** Everything needed to render or send one person's digest, computed once. */
function computeDigestContent(user: UserRow, tasks: TaskForReminder[], users: UserRow[]): DigestContent {
  const ownTasks = tasks
    .filter((t) => t.ownerId === user.id)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const ownItemCount = ownTasks.length;
  // Only used to flag "N overdue" in the subject line -- the body itself
  // is grouped by objective now (see groupByObjective below), not by
  // this overdue/due-soon/flagged bucketing.
  const overdueCount = bucketTasks(ownTasks).overdue.length;

  const reportIds = new Set(users.filter((u) => u.managerId === user.id).map((u) => u.id));
  const teamFlags = reportIds.size
    ? tasks.filter((t) => reportIds.has(t.ownerId) && isTeamFlag(t))
    : [];

  const { subject, text, html } = buildDigestMessage(user, ownTasks, overdueCount, teamFlags);
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
 * person's daily status digest -- every task they own, grouped by the
 * objective it rolls up to (soonest-due objective first), plus, if they
 * manage anyone, a short rollup of their direct reports' overdue or
 * at-risk items, grouped the same way.
 *
 * Sends over whichever channels are configured (SMTP_HOST/SMTP_USER/SMTP_PASS
 * for email, SLACK_BOT_TOKEN for Slack -- see src/lib/notifiers/). Either, both, or
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
 * email/Slack message would look like without SMTP_HOST/SMTP_USER/SMTP_PASS or
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

/** One objective's worth of tasks, sorted by due date, for the grouped layout below. */
type ObjectiveGroup = { objectiveId: string; objectiveTitle: string; tasks: TaskForReminder[] };

/**
 * Groups tasks by the objective they roll up to (via their key result),
 * each group's tasks sorted by due date, and the groups themselves
 * ordered by their soonest due date -- so the most time-sensitive
 * objective leads, but everything a person owns is visible, organized by
 * what it belongs to rather than buried in an undifferentiated list.
 */
function groupByObjective(tasks: TaskForReminder[]): ObjectiveGroup[] {
  const groups = new Map<string, ObjectiveGroup>();
  for (const t of tasks) {
    const key = t.objectiveId || t.objectiveTitle || "none";
    let g = groups.get(key);
    if (!g) {
      g = { objectiveId: t.objectiveId, objectiveTitle: t.objectiveTitle || "No objective", tasks: [] };
      groups.set(key, g);
    }
    g.tasks.push(t);
  }
  const result = Array.from(groups.values());
  for (const g of result) {
    g.tasks.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }
  result.sort((a, b) => a.tasks[0].dueDate.localeCompare(b.tasks[0].dueDate));
  return result;
}

function dueLabel(t: TaskForReminder): string {
  return format(new Date(t.dueDate), "MMM d");
}

function taskLine(t: TaskForReminder, withOwner = false): string {
  const owner = withOwner ? `${t.owner.name} — ` : "";
  const overdue = isOverdue(t.dueDate, t.status);
  let line =
    `${owner}${t.title}\n` +
    `      Key result: ${t.keyResultTitle}\n` +
    `      Due: ${dueLabel(t)}${overdue ? " (overdue)" : ""} — ${STATUS_META[t.status].label}`;
  if (t.description) line += `\n      Details: ${t.description}`;
  if (t.notes) line += `\n      Notes: ${t.notes}`;
  return line;
}

function section(title: string, tasks: TaskForReminder[], withOwner = false): string {
  if (tasks.length === 0) return "";
  const groups = groupByObjective(tasks);
  const body = groups
    .map((g) => `  ${g.objectiveTitle}:\n${g.tasks.map((t) => `    • ${taskLine(t, withOwner)}`).join("\n")}`)
    .join("\n\n");
  return `${title} (${tasks.length}):\n\n${body}`;
}

function buildDigestMessage(
  user: UserRow,
  ownTasks: TaskForReminder[],
  overdueCount: number,
  teamFlags: TaskForReminder[]
): { subject: string; text: string; html: string } {
  const textSections = [
    section("Your tasks", ownTasks),
    section("Your team needs attention on", teamFlags, true),
  ].filter(Boolean);

  const text =
    `Good morning ${user.name},\n\nHere's your AdDaptive OS status for ${format(new Date(), "MMM d, yyyy")}:\n\n` +
    (textSections.length > 0
      ? textSections.join("\n\n")
      : "You're all caught up -- nothing open right now.") +
    "\n";

  const subject =
    overdueCount > 0
      ? `AdDaptive OS: ${overdueCount} overdue task${overdueCount === 1 ? "" : "s"} — daily status`
      : `AdDaptive OS — daily status for ${format(new Date(), "MMM d")}`;

  const html = buildHtml(user, ownTasks, teamFlags);

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function htmlRow(t: TaskForReminder, withOwner: boolean): string {
  const meta = STATUS_META[t.status];
  const overdue = isOverdue(t.dueDate, t.status);
  const owner = withOwner ? `<strong>${escapeHtml(t.owner.name)}:</strong> ` : "";
  return `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #F2F4F7;">
        <div>
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${meta.dot};margin-right:8px;"></span>
          ${owner}<span style="font-weight:600;">${escapeHtml(t.title)}</span>
        </div>
        <div style="margin-left:16px;margin-top:2px;color:#667085;font-size:12px;">
          Key result: ${escapeHtml(t.keyResultTitle)}
        </div>
        <div style="margin-left:16px;margin-top:2px;color:#667085;font-size:12px;">
          Due ${dueLabel(t)}${overdue ? ' <span style="color:#B42318;font-weight:600;">(overdue)</span>' : ""} —
          <span style="color:${meta.text};font-weight:600;">${meta.label}</span>
        </div>
        ${
          t.description
            ? `<div style="margin-left:16px;margin-top:3px;color:#667085;font-size:12px;">${escapeHtml(t.description)}</div>`
            : ""
        }
        ${
          t.notes
            ? `<div style="margin-left:16px;margin-top:3px;color:#475467;font-size:12px;font-style:italic;">Notes: ${escapeHtml(t.notes)}</div>`
            : ""
        }
      </td>
    </tr>`;
}

function htmlSection(title: string, tasks: TaskForReminder[], withOwner = false): string {
  if (tasks.length === 0) return "";
  const groups = groupByObjective(tasks);
  return `
    <h3 style="font-size:13px;color:#344054;margin:20px 0 6px;">${escapeHtml(title)} (${tasks.length})</h3>
    ${groups
      .map(
        (g, i) => `
      <div style="margin:${i === 0 ? "0" : "14px"} 0 4px;${i === 0 ? "" : "padding-top:10px;border-top:1px solid #EAECF0;"}">
        <div style="font-size:11px;font-weight:700;color:#667085;text-transform:uppercase;letter-spacing:0.03em;">${escapeHtml(g.objectiveTitle)}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px;color:#101828;">
        ${g.tasks.map((t) => htmlRow(t, withOwner)).join("")}
      </table>`
      )
      .join("")}`;
}

function buildHtml(user: UserRow, ownTasks: TaskForReminder[], teamFlags: TaskForReminder[]): string {
  const body = [htmlSection("Your tasks", ownTasks), htmlSection("Your team needs attention on", teamFlags, true)].join(
    ""
  );

  return `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#F9FAFB;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #EAECF0;border-radius:12px;padding:24px;">
      <p style="font-size:15px;color:#101828;margin:0 0 4px;">Good morning ${escapeHtml(user.name)},</p>
      <p style="font-size:13px;color:#667085;margin:0 0 8px;">
        Your AdDaptive OS status for ${format(new Date(), "MMM d, yyyy")}
      </p>
      ${body || '<p style="font-size:13px;color:#667085;">You\'re all caught up -- nothing open right now.</p>'}
    </div>
  </body>
</html>`;
}
