/**
 * Base URL for links in outbound emails (account-activation/reset links,
 * the meeting-agenda link, and the "View Key Results" link added to
 * every notification and digest email below -- 2026-09-25). NEXTAUTH_URL
 * is already required for NextAuth itself in production (see README), so
 * this reuses it rather than introducing a second env var; falls back to
 * localhost for local dev where NEXTAUTH_URL is often left unset.
 *
 * Lives in its own module (rather than inside notifications.ts, where it
 * originally started) so digest.ts can import it too without the two
 * notifier modules needing to depend on each other.
 */
export function baseUrl(): string {
  return process.env.NEXTAUTH_URL || "http://localhost:3000";
}

/**
 * Absolute link to the Key Results page -- the one place every
 * objective/key-result/task can be browsed org-wide. Included as a
 * "View Key Results" link/button in every outbound notification and
 * digest email (added 2026-09-25) so an email never dead-ends without a
 * way back into the platform. Deliberately not the Home dashboard or the
 * objective's own board -- the user asked specifically for the Key
 * Results page, and it's also the one view that doesn't require the
 * recipient to already know which objective a given task belongs to.
 */
export function keyResultsUrl(): string {
  return `${baseUrl()}/key-results`;
}

/**
 * Every outbound email's subject line starts with this, in all caps, so
 * a person scanning their inbox can immediately tell an email came from
 * the platform (added 2026-09-25, per explicit request -- applies to
 * every email this app sends, including the invite/reset emails, unlike
 * the "View Key Results" link above which deliberately skips those two).
 */
export const EMAIL_SUBJECT_PREFIX = "OPERATING PLAN UPDATE";

/**
 * Prefixes a subject line with EMAIL_SUBJECT_PREFIX. Every email-building
 * function in notifications.ts/digest.ts should route its final subject
 * through this rather than prepending the prefix by hand, so the format
 * (and any future change to it) stays in one place.
 */
export function emailSubject(subject: string): string {
  return `${EMAIL_SUBJECT_PREFIX}: ${subject}`;
}
