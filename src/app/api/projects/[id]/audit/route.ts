import { NextResponse } from "next/server";
import { auditRepo } from "@/lib/db";
import { requireProjectAccess } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  if (guard.role !== "owner") {
    return NextResponse.json({ error: "Owner-only" }, { status: 403 });
  }
  return NextResponse.json(auditRepo.listForProject(params.id));
}
