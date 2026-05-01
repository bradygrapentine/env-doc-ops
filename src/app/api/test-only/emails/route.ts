import { NextResponse } from "next/server";
import { getCapturedEmails } from "@/lib/email";

// Test-only endpoint. Gated on EMAIL_SINK=memory so it cannot
// expose emails in production. Returns 404 otherwise.
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.EMAIL_SINK !== "memory") {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.json(getCapturedEmails());
}
