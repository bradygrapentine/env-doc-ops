import { NextResponse } from "next/server";
import { trafficRepo } from "@/lib/db";
import { validateRow } from "@/lib/csv";
import { requireOwnedProject } from "@/lib/session";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const raw = (body as { row?: unknown } | null)?.row;
  if (!raw || typeof raw !== "object") {
    return NextResponse.json({ error: "Missing row object" }, { status: 400 });
  }

  const v = validateRow(raw as Record<string, unknown>);
  if (!v.ok) {
    return NextResponse.json({ error: "Invalid row", issues: v.issues }, { status: 400 });
  }

  const stored = trafficRepo.addRow(params.id, v.row);
  return NextResponse.json(stored);
}
