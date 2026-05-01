import { NextResponse } from "next/server";
import { reportRepo } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const report = reportRepo.get(params.id);
  if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  return NextResponse.json(report);
}
