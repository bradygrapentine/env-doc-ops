import { NextResponse } from "next/server";
import { parseTrafficCsvDetailed } from "@/lib/csv";
import { requireOwnedProject } from "@/lib/session";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;

  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty CSV body" }, { status: 400 });

  const detailed = parseTrafficCsvDetailed(text);
  if (detailed.fatal) {
    return NextResponse.json({ error: detailed.fatal }, { status: 400 });
  }

  return NextResponse.json(detailed);
}
