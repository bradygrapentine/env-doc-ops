import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { userRepo } from "@/lib/db";

export async function POST(req: Request) {
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

  return NextResponse.json({ id: user.id, email: user.email, name: user.name, claimed });
}
