import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userRepo } from "@/lib/db";
import { tokenRepo } from "@/lib/tokens";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = String((body as { token?: unknown }).token ?? "");
  const newPassword = String((body as { newPassword?: unknown }).newPassword ?? "");

  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters" },
      { status: 400 },
    );
  }

  const result = tokenRepo.consumeReset(token);
  if ("error" in result) {
    const messages = {
      invalid: "Reset link is invalid.",
      expired: "Reset link has expired.",
      used: "Reset link has already been used.",
    } as const;
    return NextResponse.json({ error: messages[result.error] }, { status: 400 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  userRepo.updatePassword(result.userId, hash);

  return NextResponse.json({ ok: true });
}
