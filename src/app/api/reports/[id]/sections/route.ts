import { NextResponse } from "next/server";
import { reportRepo } from "@/lib/db";
import { requireOwnedReport } from "@/lib/session";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedReport(params.id);
  if (!guard.ok) return guard.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const titleRaw = (body as { title?: unknown }).title;
  if (typeof titleRaw !== "string" || titleRaw.trim().length === 0)
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (titleRaw.length > 200)
    return NextResponse.json({ error: "title must be <= 200 chars" }, { status: 400 });

  const contentRaw = (body as { content?: unknown }).content;
  const content = typeof contentRaw === "string" ? contentRaw : "";

  const section = reportRepo.addCustomSection(params.id, { title: titleRaw, content });
  if (!section) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(section);
}
