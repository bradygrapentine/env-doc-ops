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
  // Race: someone else might have grabbed the email between createEmailChange and now.
  if (userRepo.findByEmail(result.newEmail)) {
    return NextResponse.redirect(new URL("/account?email_change=conflict", url.origin));
  }
  userRepo.updateEmail(result.userId, result.newEmail);
  return NextResponse.redirect(new URL("/account?email_change=ok", url.origin));
}
