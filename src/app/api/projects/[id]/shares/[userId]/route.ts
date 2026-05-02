import { NextResponse } from "next/server";
import { auditRepo, shareRepo } from "@/lib/db";
import { requireProjectAccess } from "@/lib/session";
import type { ShareRole } from "@/lib/types";

function ownerOnly(guard: { role: string }) {
  return guard.role === "owner";
}

export async function PATCH(req: Request, { params }: { params: { id: string; userId: string } }) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  if (!ownerOnly(guard)) {
    return NextResponse.json({ error: "Owner-only" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { role?: unknown } | null;
  const role = body?.role;
  if (role !== "reader" && role !== "editor") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  const ok = await shareRepo.updateRole(params.id, params.userId, role as ShareRole);
  if (!ok) return NextResponse.json({ error: "Share not found" }, { status: 404 });
  await auditRepo.log({
    projectId: params.id,
    userId: guard.userId,
    action: "share.role_change",
    details: { targetUserId: params.userId, role },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  if (!ownerOnly(guard)) {
    return NextResponse.json({ error: "Owner-only" }, { status: 403 });
  }
  const ok = await shareRepo.remove(params.id, params.userId);
  if (!ok) return NextResponse.json({ error: "Share not found" }, { status: 404 });
  await auditRepo.log({
    projectId: params.id,
    userId: guard.userId,
    action: "share.remove",
    details: { targetUserId: params.userId },
  });
  return new Response(null, { status: 204 });
}
