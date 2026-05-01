import { NextResponse } from "next/server";
import { userRepo } from "@/lib/db";
import { tokenRepo } from "@/lib/tokens";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/account?email_change=missing", url.origin));
  }
  const result = tokenRepo.consumeEmailChange(token);
  if ("error" in result) {
    return NextResponse.redirect(new URL(`/account?email_change=${result.error}`, url.origin));
  }
  // Two layers of conflict handling: a fast-path read so the common case
  // returns conflict cleanly, and a try/catch so the narrow TOCTOU window
  // (concurrent UPDATE racing past the read) also surfaces as conflict
  // instead of a 500. users.email has a UNIQUE constraint that backs this.
  if (userRepo.findByEmail(result.newEmail)) {
    return NextResponse.redirect(new URL("/account?email_change=conflict", url.origin));
  }
  try {
    userRepo.updateEmail(result.userId, result.newEmail);
  } catch (err) {
    if ((err as Error).message?.includes("UNIQUE constraint failed")) {
      return NextResponse.redirect(new URL("/account?email_change=conflict", url.origin));
    }
    throw err;
  }
  return NextResponse.redirect(new URL("/account?email_change=ok", url.origin));
}
