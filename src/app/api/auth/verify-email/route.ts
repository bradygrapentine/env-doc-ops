import { NextResponse, type NextRequest } from "next/server";
import { userRepo } from "@/lib/db";
import { tokenRepo } from "@/lib/tokens";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const result = tokenRepo.consumeVerification(token);
  const target = req.nextUrl.clone();
  target.pathname = "/account";
  target.search = "";

  if ("error" in result) {
    target.searchParams.set("verified", "error");
    return NextResponse.redirect(target);
  }

  userRepo.markEmailVerified(result.userId);
  target.searchParams.set("verified", "1");
  return NextResponse.redirect(target);
}
