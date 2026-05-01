import { NextResponse, type NextRequest } from "next/server";
import { userRepo } from "@/lib/db";
import { tokenRepo } from "@/lib/tokens";
import { sendVerificationEmail } from "@/lib/email";
import { getSessionUserId } from "@/lib/session";

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = userRepo.findById(userId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { token } = tokenRepo.createVerification(userId);
    const link = `${req.nextUrl.origin}/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(user.email, link);
  } catch (err) {
    console.warn("[send-verification] failed:", (err as Error).message);
  }

  return NextResponse.json({ ok: true });
}
