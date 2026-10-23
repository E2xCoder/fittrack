import { timingSafeEqual } from "crypto";

/**
 * True only when the request carries "Authorization: Bearer <CRON_SECRET>".
 * Fails closed: with no CRON_SECRET configured nothing is authorised (the old
 * inline check compared against the string "Bearer undefined", which anyone
 * could send), and the comparison is constant-time.
 */
export function isCronAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const got = Buffer.from(request.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}
