/**
 * Sends the daily digest email via any SMTP server (SES, SendGrid, Postmark,
 * Mailgun, or a local relay — whatever you point SMTP_HOST at).
 *
 * Required env vars to enable sending:
 *   SMTP_HOST     — e.g. email-smtp.us-east-1.amazonaws.com
 *   SMTP_USER     — SMTP username (for SES: the SMTP credential, not an IAM key)
 *   SMTP_PASS     — SMTP password
 *
 * Optional:
 *   SMTP_PORT     — defaults to 587 (STARTTLS). Use 465 for SSL.
 *   SMTP_SECURE   — set to "true" to force SSL (required for port 465)
 *   DIGEST_FROM_EMAIL — "From" address, e.g. "AdDaptive OS <status@yourcompany.com>"
 *                       Must be a verified sender on whichever provider you use.
 *
 * Without SMTP_HOST/USER/PASS, logs what would have been sent and returns
 * { sent: false } so the digest sweep can still run (e.g. Slack alone works).
 */
import nodemailer from "nodemailer";

export type SendResult = { sent: boolean; reason?: string };

export async function sendDigestEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<SendResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const secure = process.env.SMTP_SECURE === "true";
  const from = process.env.DIGEST_FROM_EMAIL || `AdDaptive OS <${user}>`;

  if (!host || !user || !pass) {
    console.log(`[digest email] SMTP not configured — would email ${to}: "${subject}"`);
    return { sent: false, reason: "SMTP_HOST, SMTP_USER, or SMTP_PASS is not configured" };
  }

  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

  try {
    await transporter.sendMail({ from, to, subject, html, text });
    return { sent: true };
  } catch (err) {
    console.error(`[digest email] failed to send to ${to}:`, err);
    return { sent: false, reason: err instanceof Error ? err.message : "unknown SMTP error" };
  }
}
