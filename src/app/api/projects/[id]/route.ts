import { NextResponse } from "next/server";
import { projectRepo } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const project = projectRepo.get(params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(project);
}
