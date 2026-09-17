/**
 * Sends the daily digest email via Resend (https://resend.com).
 *
 * Set RESEND_API_KEY to enable real sending. Without it, this logs what
 * would have been sent and returns { sent: false } so the digest sweep can
 * keep running (e.g. Slack alone can still work) without crashing.
 *
 * DIGEST_FROM_EMAIL controls the "from" address/name. Resend's shared
 * `onboarding@resend.dev` address only delivers to the email you signed up
 * to Resend with -- once you verify your own sending domain in Resend, set
 * DIGEST_FROM_EMAIL to an address on that domain to email your whole team.
 */
export type SendResult = { sent: boolean; reason?: string };

export async function sendDigestEmail(
  to: string,
  subject: string,
  html: string,
  text: string
): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM_EMAIL || "AdDaptive OS <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[digest email] RESEND_API_KEY not set — would email ${to}: "${subject}"`);
    return { sent: false, reason: "RESEND_API_KEY is not configured" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[digest email] Resend API error ${res.status} for ${to}: ${body}`);
      return { sent: false, reason: `Resend API error ${res.status}` };
    }

    return { sent: true };
  } catch (err) {
    console.error(`[digest email] failed to send to ${to}:`, err);
    return { sent: false, reason: "network error calling Resend" };
  }
}
