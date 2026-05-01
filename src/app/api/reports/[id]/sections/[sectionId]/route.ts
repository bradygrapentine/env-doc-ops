import { NextResponse } from "next/server";
import { reportRepo } from "@/lib/db";
import type { SectionStatus } from "@/lib/types";

const STATUSES: SectionStatus[] = ["draft", "reviewed", "final"];

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; sectionId: string } },
) {
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const patch: { content?: string; status?: SectionStatus; title?: string } = {};
  if (typeof body.content === "string") patch.content = body.content;
  if (typeof body.title === "string") patch.title = body.title;
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Expected one of ${STATUSES.join(", ")}.` },
        { status: 400 },
      );
    }
    patch.status = body.status;
  }

  const updated = reportRepo.updateSection(params.id, params.sectionId, patch);
  if (!updated) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(updated);
}
