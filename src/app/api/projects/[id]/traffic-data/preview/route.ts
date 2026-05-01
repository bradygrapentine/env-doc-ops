import { NextResponse } from "next/server";
import { projectRepo } from "@/lib/db";
import { parseTrafficCsvDetailed } from "@/lib/csv";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const project = projectRepo.get(params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

  const text = await req.text();
  if (!text.trim()) return NextResponse.json({ error: "Empty CSV body" }, { status: 400 });

  const detailed = parseTrafficCsvDetailed(text);
  if (detailed.fatal) {
    return NextResponse.json({ error: detailed.fatal }, { status: 400 });
  }

  return NextResponse.json(detailed);
}
