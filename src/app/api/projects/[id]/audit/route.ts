import { NextResponse } from "next/server";
import { auditRepo } from "@/lib/db";
import { requireProjectAccess } from "@/lib/session";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  if (guard.role !== "owner") {
    return NextResponse.json({ error: "Owner-only" }, { status: 403 });
  }
  // Cursor pagination: ?limit (default 50, max 200) + ?before=<ISO createdAt>.
  // Invalid limit values silently fall back to the repo default.
  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const before = url.searchParams.get("before") ?? undefined;
  const opts: { limit?: number; before?: string } = {};
  if (limitParam !== null) {
    const parsed = Number(limitParam);
    if (Number.isFinite(parsed) && parsed > 0) opts.limit = parsed;
  }
  if (before) opts.before = before;
  return NextResponse.json(await auditRepo.listForProject(params.id, opts));
}
