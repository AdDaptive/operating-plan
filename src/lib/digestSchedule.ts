/**
 * Whether the daily digest's external cron trigger should actually run
 * right now. Evaluated in America/New_York local time (via Intl's
 * timeZone option, which carries its own DST rules) rather than against
 * the server/container's own clock -- so this automatically accounts
 * for the EST/EDT switch twice a year with no cron-expression or config
 * change needed anywhere, on this app or in Coolify.
 *
 * This is deliberately a window (08:15-08:44 Eastern), not an exact
 * minute match: the scheduler that calls `GET /api/digest/run` is
 * expected to fire every ~15 minutes (see the README's Coolify Scheduled
 * Task setup) so it's guaranteed to land at least one call inside the
 * window regardless of the scheduler's own timezone. It's harmless if
 * more than one call in the window actually reaches `runDailyDigest()`
 * -- its existing per-person/channel/day dedup (the `digest_logs` table)
 * already makes a second same-day run a no-op.
 *
 * Only gates the scheduled GET trigger -- the "Send daily digest now"
 * button's POST trigger calls `runDailyDigest()` directly and is
 * unaffected, since a manual send should always run immediately
 * whenever someone clicks it.
 */
export function isWithinDigestWindow(now: Date = new Date()): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "-1");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "-1");
  // Intl's hour12:false can report midnight as "24" rather than "00" in
  // some ICU builds -- not reachable at an 08:xx target, but normalized
  // here anyway so this function is correct at any target hour.
  const normalizedHour = hour === 24 ? 0 : hour;
  return normalizedHour === 8 && minute >= 15 && minute < 45;
}
