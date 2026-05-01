import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userRepo } from "@/lib/db";
import { tokenRepo } from "@/lib/tokens";
import { sendEmailChangeConfirmation } from "@/lib/email";
import { getSessionUserId } from "@/lib/session";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as {
    newEmail?: unknown;
    currentPassword?: unknown;
  } | null;
  const newEmailRaw = body?.newEmail;
  const currentPassword = body?.currentPassword;
  if (typeof newEmailRaw !== "string" || !EMAIL_RE.test(newEmailRaw.trim())) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return NextResponse.json({ error: "currentPassword required" }, { status: 400 });
  }
  const newEmail = newEmailRaw.trim().toLowerCase();

  const user = userRepo.findById(userId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.email === newEmail) {
    return NextResponse.json({ error: "New email matches current email" }, { status: 400 });
  }

  // Verify the password BEFORE checking for an email conflict — otherwise the
  // 409 short-circuits the bcrypt call, letting an authenticated attacker
  // probe whether arbitrary emails exist on the system in a fast loop.
  const full = userRepo.findByEmail(user.email);
  if (!full || !(await bcrypt.compare(currentPassword, full.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  if (userRepo.findByEmail(newEmail)) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const { token } = tokenRepo.createEmailChange(userId, newEmail);
  const origin = req.headers.get("origin") ?? process.env.AUTH_URL ?? "http://localhost:3000";
  const link = `${origin}/api/auth/confirm-email-change?token=${token}`;
  await sendEmailChangeConfirmation(newEmail, link);

  return NextResponse.json({ ok: true });
}
