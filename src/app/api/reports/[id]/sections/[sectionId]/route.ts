import { NextResponse } from "next/server";
import { reportRepo } from "@/lib/db";
import { requireOwnedReport } from "@/lib/session";
import type { SectionStatus } from "@/lib/types";

const STATUSES: SectionStatus[] = ["draft", "reviewed", "final"];

export async function PATCH(
  req: Request,
  { params }: { params: { id: string; sectionId: string } },
) {
  const guard = await requireOwnedReport(params.id);
  if (!guard.ok) return guard.error;

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

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; sectionId: string } },
) {
  const guard = await requireOwnedReport(params.id);
  if (!guard.ok) return guard.error;

  const result = reportRepo.removeSection(params.id, params.sectionId);
  if (result.ok) return new NextResponse(null, { status: 204 });
  if (result.reason === "standard")
    return NextResponse.json({ error: "Cannot delete a standard section" }, { status: 400 });
  return NextResponse.json({ error: "Section not found" }, { status: 404 });
}
