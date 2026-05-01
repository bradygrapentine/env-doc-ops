import { NextResponse } from "next/server";
import { consume, resetSucceeded } from "./rate-limit";

export const PASSWORD_BUCKET = { max: 5, windowMs: 15 * 60 * 1000 };

/**
 * Apply the password-bearing-endpoint rate limit. Returns a 429 NextResponse
 * to short-circuit with, or null when the call should proceed.
 *
 * IMPORTANT: must be called BEFORE bcrypt — otherwise a rate limit doesn't
 * actually limit anything (the bcrypt cost is what we're protecting). Also,
 * when blocked, return 429 unconditionally and never reveal whether the
 * password was correct (an attacker mid-block could otherwise read the
 * status code to check candidate passwords).
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

export function clearPasswordRateLimit(userId: string, action: string): void {
  resetSucceeded(userId, action);
}
