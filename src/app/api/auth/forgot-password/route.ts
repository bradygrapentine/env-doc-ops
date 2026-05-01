import { NextResponse, type NextRequest } from "next/server";
import { userRepo } from "@/lib/db";
import { tokenRepo } from "@/lib/tokens";
import { emailLinkBase, sendPasswordResetEmail } from "@/lib/email";
import { gateUnauthenticatedEndpoint, clientIp, FORGOT_BUCKET } from "@/lib/rate-limit-policy";

export async function POST(req: NextRequest) {
  // IP-keyed (not email-keyed) so probing the limiter for different emails
  // can't reveal which addresses exist in the user table.
  const blocked = gateUnauthenticatedEndpoint(clientIp(req), "forgot-password", FORGOT_BUCKET);
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  const email = String((body && (body as { email?: unknown }).email) ?? "")
    .trim()
    .toLowerCase();

  // Always return 200 — don't leak existence.
  if (!email || !email.includes("@")) {
    return NextResponse.json({ ok: true });
  }

  const user = userRepo.findByEmail(email);
  if (user) {
    try {
      const { token } = tokenRepo.createReset(user.id);
      const link = `${emailLinkBase(req)}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.email, link);
    } catch (err) {
      console.warn("[forgot-password] failed:", (err as Error).message);
    }
  }

  return NextResponse.json({ ok: true });
}
