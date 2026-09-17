/**
 * Sends the daily digest as a Slack DM via the Slack Web API.
 *
 * Set SLACK_BOT_TOKEN (a Bot User OAuth Token, starts with "xoxb-") to
 * enable real sending. The bot needs these scopes:
 *   - users:read.email   (to find a Slack user from their AdDaptive OS
 *     email address -- no separate "Slack user ID" field needed anywhere)
 *   - im:write            (to open a DM with that user)
 *   - chat:write          (to post the message)
 *
 * Create the app at https://api.slack.com/apps, add those scopes under
 * "OAuth & Permissions", install the app to your workspace, and copy the
 * "Bot User OAuth Token" it gives you into SLACK_BOT_TOKEN. Without that
 * env var set, this logs what would have been sent and returns
 * { sent: false } so the sweep keeps going (e.g. email alone can still
 * work).
 */
import type { SendResult } from "./email";

async function slackGet(
  method: string,
  token: string,
  params: Record<string, string>
): Promise<any> {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
}

async function slackPost(
  method: string,
  token: string,
  body: Record<string, unknown>
): Promise<any> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

export async function sendDigestSlackDM(email: string, text: string): Promise<SendResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    console.log(`[digest slack] SLACK_BOT_TOKEN not set — would DM ${email}`);
    return { sent: false, reason: "SLACK_BOT_TOKEN is not configured" };
  }

  try {
    const lookup = await slackGet("users.lookupByEmail", token, { email });
    if (!lookup.ok) {
      console.warn(`[digest slack] no Slack user found for ${email}: ${lookup.error}`);
      return { sent: false, reason: `Slack lookup failed: ${lookup.error}` };
    }

    const open = await slackPost("conversations.open", token, { users: lookup.user.id });
    if (!open.ok) {
      console.warn(`[digest slack] could not open DM with ${email}: ${open.error}`);
      return { sent: false, reason: `Slack DM open failed: ${open.error}` };
    }

    const post = await slackPost("chat.postMessage", token, {
      channel: open.channel.id,
      text,
    });
    if (!post.ok) {
      console.warn(`[digest slack] could not post to ${email}: ${post.error}`);
      return { sent: false, reason: `Slack post failed: ${post.error}` };
    }

    return { sent: true };
  } catch (err) {
    console.error(`[digest slack] failed to send to ${email}:`, err);
    return { sent: false, reason: "network error calling Slack" };
  }
}
