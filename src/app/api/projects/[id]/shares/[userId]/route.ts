import { NextResponse } from "next/server";
import { shareRepo } from "@/lib/db";
import { requireProjectAccess } from "@/lib/session";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const guard = await requireProjectAccess(params.id, "write");
  if (!guard.ok) return guard.error;
  const ok = shareRepo.remove(params.id, params.userId);
  if (!ok) return NextResponse.json({ error: "Share not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
