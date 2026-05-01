import { NextResponse } from "next/server";
import { trafficRepo } from "@/lib/db";
import { validateRow } from "@/lib/csv";
import { requireOwnedProject } from "@/lib/session";

export async function PATCH(req: Request, { params }: { params: { id: string; rowId: string } }) {
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;

  const existing = trafficRepo.getRow(params.id, params.rowId);
  if (!existing) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const patch = body as Record<string, unknown>;
  const allowed = ["intersection", "period", "approach", "inbound", "outbound", "total"] as const;
  const cleaned: Record<string, unknown> = {};
  for (const k of allowed) {
    if (k in patch) cleaned[k] = patch[k];
  }

  // Merge with existing for validation.
  const merged: Record<string, unknown> = {
    intersection: existing.intersection,
    period: existing.period,
    approach: existing.approach,
    inbound: existing.inbound,
    outbound: existing.outbound,
    total: existing.total,
    ...cleaned,
  };

  const v = validateRow(merged);
  if (!v.ok) {
    return NextResponse.json({ error: "Invalid row", issues: v.issues }, { status: 400 });
  }

  const updated = trafficRepo.updateRow(params.id, params.rowId, v.row);
  if (!updated) {
    return NextResponse.json({ error: "Row not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string; rowId: string } }) {
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;

  const ok = trafficRepo.deleteRow(params.id, params.rowId);
  if (!ok) return NextResponse.json({ error: "Row not found" }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
