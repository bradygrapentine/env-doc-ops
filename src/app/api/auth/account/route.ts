import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userRepo } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function DELETE(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { currentPassword?: unknown } | null;
  const currentPassword = body?.currentPassword;
  if (typeof currentPassword !== "string" || currentPassword.length === 0) {
    return NextResponse.json({ error: "currentPassword required" }, { status: 400 });
  }

  const user = userRepo.findById(userId);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const full = userRepo.findByEmail(user.email);
  if (!full || !(await bcrypt.compare(currentPassword, full.passwordHash))) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  userRepo.delete(userId);
  return NextResponse.json({ ok: true });
}
