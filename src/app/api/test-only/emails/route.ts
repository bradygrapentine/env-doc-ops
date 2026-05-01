import { NextResponse } from "next/server";
import { getCapturedEmails } from "@/lib/email";

// Test-only endpoint. Gated on EMAIL_SINK=memory so it cannot
// expose emails in production. Returns 404 otherwise.
export const dynamic = "force-dynamic";

export async function GET() {
  // Gate: only serve when EMAIL_SINK=memory. Production deploys must not set
  // this env — that is the safety boundary. Middleware also enforces this
  // before the request reaches the handler.
  if (process.env.EMAIL_SINK !== "memory") {
    return new NextResponse("Not Found", { status: 404 });
  }
  return NextResponse.json(getCapturedEmails());
}
