import { NextResponse } from "next/server";
import { requireReportAccess } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireReportAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  return NextResponse.json(guard.report);
}
