import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userRepo } from "@/lib/db";
import { tokenRepo } from "@/lib/tokens";
import { emailLinkBase, sendVerificationEmail } from "@/lib/email";
import { gateUnauthenticatedEndpoint, clientIp, SIGNUP_BUCKET } from "@/lib/rate-limit-policy";

export async function POST(req: Request) {
  const blocked = gateUnauthenticatedEndpoint(clientIp(req), "signup", SIGNUP_BUCKET);
  if (blocked) return blocked;

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const email = String(body.email ?? "")
    .trim()
    .toLowerCase();
  const password = String(body.password ?? "");
  const name = String(body.name ?? "").trim();

  if (!email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name required" }, { status: 400 });
  }

  if (userRepo.findByEmail(email)) {
    return NextResponse.json({ error: "Account with that email already exists" }, { status: 409 });
  }

  const isFirstUser = userRepo.count() === 0;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = userRepo.create({ email, passwordHash, name });

  let claimed = 0;
  if (isFirstUser) {
    claimed = userRepo.claimOrphanProjects(user.id);
  }

  // Kick off verification email — failure must not block signup.
  try {
    const { token } = tokenRepo.createVerification(user.id);
    const link = `${emailLinkBase(req)}/api/auth/verify-email?token=${token}`;
    await sendVerificationEmail(user.email, link);
  } catch (err) {
    console.warn("[signup] failed to send verification email:", (err as Error).message);
  }

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, claimed });
}
