import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userRepo } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { clearPasswordRateLimit, gatePasswordEndpoint } from "@/lib/rate-limit-policy";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocked = gatePasswordEndpoint(userId, "change-password");
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const currentPassword = (body as { currentPassword?: unknown }).currentPassword;
  const newPassword = (body as { newPassword?: unknown }).newPassword;

  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return NextResponse.json({ error: "currentPassword required" }, { status: 400 });
  }
  if (typeof newPassword !== "string" || newPassword.length === 0) {
    return NextResponse.json({ error: "newPassword required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const user = userRepo.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // findById doesn't return passwordHash; re-fetch via email to get it.
  const full = userRepo.findByEmail(user.email);
  if (!full) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await bcrypt.compare(currentPassword, full.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  userRepo.updatePassword(userId, newHash);
  clearPasswordRateLimit(userId, "change-password");

  return NextResponse.json({ ok: true });
}
