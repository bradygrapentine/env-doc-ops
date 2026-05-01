import { NextResponse } from "next/server";
import { consume, resetSucceeded } from "./rate-limit";

export const PASSWORD_BUCKET = { max: 5, windowMs: 15 * 60 * 1000 };

// Unauthenticated endpoint buckets. Signin/forgot use the same shape; signup
// is tighter because account creation is a higher-cost action.
export const SIGNIN_BUCKET = { max: 10, windowMs: 15 * 60 * 1000 };
export const FORGOT_BUCKET = { max: 10, windowMs: 15 * 60 * 1000 };
export const SIGNUP_BUCKET = { max: 3, windowMs: 60 * 60 * 1000 };

/**
 * Extract a best-effort client IP from a Request. Falls back to "unknown" so
 * the rate limiter still keys to *something* in dev / when proxy headers are
 * missing — better than letting the request bypass the gate entirely.
 *
 * Trusts x-forwarded-for. In a deploy fronted by an untrusted edge that lets
 * clients spoof this header, IP-keyed limiting is bypassable per-request;
 * email-keyed (signin / forgot) doesn't have that problem.
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Apply the password-bearing-endpoint rate limit. Returns a 429 NextResponse
 * to short-circuit with, or null when the call should proceed.
 *
 * IMPORTANT: must be called BEFORE bcrypt — otherwise a rate limit doesn't
 * actually limit anything (the bcrypt cost is what we're protecting). Also,
 * when blocked, return 429 unconditionally and never reveal whether the
 * password was correct (an attacker mid-block could otherwise read the
 * status code to check candidate passwords).
 *
 * Known limitations (intentional for V1):
 *   • Burst-TOCTOU: N concurrent in-flight bcrypt checks can race past the
 *     pre-bcrypt counter. The first ~max+ε arrive before any reach bcrypt,
 *     so "max=5" is actually "max=5 + concurrent burst". Soft under burst,
 *     not a brute-force escalation primitive.
 *   • Timing side-channel: a 429 response is markedly faster than a real
 *     bcrypt call. Once an attacker is in the blocked state they can tell
 *     they're blocked (which they already know — they got 429s). We don't
 *     pad with artificial latency because that contradicts the goal of
 *     throttling bcrypt cost.
 *   • Multi-process: see SECURITY comment in rate-limit.ts.
 */
export function gatePasswordEndpoint(userId: string, action: string): NextResponse | null {
  const r = consume(userId, action, PASSWORD_BUCKET);
  if (r.ok) return null;
  return NextResponse.json(
    { error: "Too many attempts. Try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(r.retryAfterMs / 1000)) },
    },
  );
}

/**
 * Generic rate-limit gate for unauthenticated endpoints. Pass any string as
 * key (typically client IP for signup, email for signin). Returns a 429
 * NextResponse to short-circuit with, or null when the call should proceed.
 */
export function gateUnauthenticatedEndpoint(
  key: string,
  action: string,
  bucket: { max: number; windowMs: number },
): NextResponse | null {
  if (process.env.RATE_LIMIT_DISABLED === "1") return null;
  const r = consume(key, action, bucket);
  if (r.ok) return null;
  return NextResponse.json(
    { error: "Too many attempts. Try again later." },
    {
      status: 429,
      headers: { "Retry-After": String(Math.ceil(r.retryAfterMs / 1000)) },
    },
  );
}

/**
 * Soft gate for places that can't return an HTTP 429 (e.g. inside Auth.js
 * Credentials.authorize, which can only return User|null). Returns true when
 * blocked so the caller can silently fail.
 */
export function isUnauthenticatedBlocked(
  key: string,
  action: string,
  bucket: { max: number; windowMs: number },
): boolean {
  if (process.env.RATE_LIMIT_DISABLED === "1") return false;
  const r = consume(key, action, bucket);
  return !r.ok;
}

export function clearPasswordRateLimit(userId: string, action: string): void {
  resetSucceeded(userId, action);
}
