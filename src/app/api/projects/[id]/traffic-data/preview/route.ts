import { NextResponse } from "next/server";
import {
  parseTrafficCsvDetailed,
  checkCsvBodyCap,
  CSV_ROW_MAX,
  CSV_BODY_MAX_BYTES,
} from "@/lib/csv";
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

  const detailed = parseTrafficCsvDetailed(text);
  if (detailed.fatal) {
    return NextResponse.json({ error: detailed.fatal }, { status: 400 });
  }
  if (detailed.totalRows > CSV_ROW_MAX) {
    return NextResponse.json(
      { error: `CSV has ${detailed.totalRows} rows; cap is ${CSV_ROW_MAX}` },
      { status: 422 },
    );
  }

  return NextResponse.json(detailed);
}
