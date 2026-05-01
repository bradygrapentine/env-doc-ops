import { NextResponse } from "next/server";
import { trafficRepo } from "@/lib/db";
import { parseTrafficCsv } from "@/lib/csv";
import { requireOwnedProject } from "@/lib/session";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;

  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty CSV body" }, { status: 400 });

  const parsed = parseTrafficCsv(text);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const stored = trafficRepo.replaceForProject(params.id, parsed.rows);
  const intersections = Array.from(new Set(stored.map((r) => r.intersection)));

  return NextResponse.json({ rowsImported: stored.length, intersections });
}
