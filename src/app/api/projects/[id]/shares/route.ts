import { NextResponse } from "next/server";
import { shareRepo, userRepo } from "@/lib/db";
import { requireProjectAccess } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  if (guard.role !== "owner") {
    return NextResponse.json({ error: "Read-only access" }, { status: 403 });
  }
  return NextResponse.json(shareRepo.listForProject(params.id));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectAccess(params.id, "write");
  if (!guard.ok) return guard.error;

  const body = (await req.json().catch(() => null)) as { email?: unknown } | null;
  if (!body || typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "Missing or invalid field: email" }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  const target = userRepo.findByEmail(email);
  if (!target) {
    return NextResponse.json({ error: "No user with that email" }, { status: 404 });
  }
  if (target.id === guard.project.userId) {
    return NextResponse.json({ error: "Owner is already implicit" }, { status: 400 });
  }
  // idempotent — if exists, return 200 with the existing share
  shareRepo.add(params.id, target.id, "reader");
  const list = shareRepo.listForProject(params.id);
  const found = list.find((s) => s.userId === target.id);
  return NextResponse.json(found, { status: 200 });
}
