import { NextResponse } from "next/server";
import { auditRepo, reportRepo } from "@/lib/db";
import { requireOwnedReport } from "@/lib/session";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedReport(params.id);
  if (!guard.ok) return guard.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object")
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const orderedIds = (body as { orderedIds?: unknown }).orderedIds;
  if (!Array.isArray(orderedIds) || orderedIds.some((x) => typeof x !== "string"))
    return NextResponse.json({ error: "orderedIds must be an array of strings" }, { status: 400 });

  const ok = reportRepo.reorderSections(params.id, orderedIds as string[]);
  if (!ok)
    return NextResponse.json(
      {
        error:
          "orderedIds must contain exactly the report's existing section ids (no additions, removals, or duplicates)",
      },
      { status: 400 },
    );

  const updated = reportRepo.get(params.id);
  auditRepo.log({
    projectId: guard.project.id,
    userId: guard.userId,
    action: "section.reorder",
    details: { count: (orderedIds as string[]).length },
  });
  return NextResponse.json(updated);
}
