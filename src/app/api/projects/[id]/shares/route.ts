import { NextResponse } from "next/server";
import { auditRepo, shareRepo, userRepo } from "@/lib/db";
import { requireProjectAccess } from "@/lib/session";
import type { ShareRole } from "@/lib/types";

function ownerOnly(guard: { role: string }) {
  return guard.role === "owner";
}

function parseRole(raw: unknown): ShareRole | null {
  if (raw === undefined) return "reader";
  if (raw === "reader" || raw === "editor") return raw;
  return null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  if (!ownerOnly(guard)) {
    return NextResponse.json({ error: "Owner-only" }, { status: 403 });
  }
  return NextResponse.json(await shareRepo.listForProject(params.id));
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  if (!ownerOnly(guard)) {
    return NextResponse.json({ error: "Owner-only" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as { email?: unknown; role?: unknown } | null;
  if (!body || typeof body.email !== "string" || !body.email.trim()) {
    return NextResponse.json({ error: "Missing or invalid field: email" }, { status: 400 });
  }
  const role = parseRole(body.role);
  if (!role) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const email = body.email.trim().toLowerCase();
  const target = await userRepo.findByEmail(email);
  if (!target) {
    return NextResponse.json({ error: "No user with that email" }, { status: 404 });
  }
  if (target.id === guard.project.userId) {
    return NextResponse.json({ error: "Owner is already implicit" }, { status: 400 });
  }
  const added = await shareRepo.add(params.id, target.id, role);
  if (!added) {
    await shareRepo.updateRole(params.id, target.id, role);
  }
  await auditRepo.log({
    projectId: params.id,
    userId: guard.userId,
    action: added ? "share.add" : "share.role_change",
    details: { targetUserId: target.id, role },
  });
  const list = await shareRepo.listForProject(params.id);
  const found = list.find((s) => s.userId === target.id);
  return NextResponse.json(found, { status: 200 });
}
