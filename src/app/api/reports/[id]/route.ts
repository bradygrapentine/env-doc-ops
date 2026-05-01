import { NextResponse } from "next/server";
import { requireOwnedReport } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireOwnedReport(params.id);
  if (!guard.ok) return guard.error;
  return NextResponse.json(guard.report);
}
