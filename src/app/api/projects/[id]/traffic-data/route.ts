import { NextResponse } from "next/server";
import { auditRepo, trafficRepo } from "@/lib/db";
import { parseTrafficCsv, checkCsvBodyCap, CSV_ROW_MAX, CSV_BODY_MAX_BYTES } from "@/lib/csv";
import { requireOwnedProject } from "@/lib/session";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;

  const text = await req.text();
  const cap = checkCsvBodyCap(req.headers.get("content-length"), text);
  if (cap?.tooLarge) {
    return NextResponse.json(
      { error: `CSV body exceeds ${CSV_BODY_MAX_BYTES} bytes (1 MiB) cap` },
      { status: 413 },
    );
  }
  if (!text.trim()) return NextResponse.json({ error: "Empty CSV body" }, { status: 400 });

  const parsed = parseTrafficCsv(text);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.rows.length > CSV_ROW_MAX) {
    return NextResponse.json(
      { error: `CSV has ${parsed.rows.length} rows; cap is ${CSV_ROW_MAX}` },
      { status: 422 },
    );
  }

  const stored = await trafficRepo.replaceForProject(params.id, parsed.rows);
  const intersections = Array.from(new Set(stored.map((r) => r.intersection)));

  await auditRepo.log({
    projectId: params.id,
    userId: guard.userId,
    action: "traffic.import",
    details: { rowsImported: stored.length, intersections: intersections.length },
  });

  return NextResponse.json({ rowsImported: stored.length, intersections });
}
