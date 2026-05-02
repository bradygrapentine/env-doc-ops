import { NextResponse } from "next/server";
import { projectRepo } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await projectRepo.listAccessible(userId));
}

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const required = [
    "name",
    "location",
    "jurisdiction",
    "projectType",
    "developmentSummary",
  ] as const;
  for (const key of required) {
    if (!body[key] || typeof body[key] !== "string") {
      return NextResponse.json({ error: `Missing or invalid field: ${key}` }, { status: 400 });
    }
  }

  const project = await projectRepo.create({
    userId,
    name: body.name,
    location: body.location,
    jurisdiction: body.jurisdiction,
    projectType: body.projectType,
    developmentSummary: body.developmentSummary,
    clientName: body.clientName || undefined,
    preparedBy: body.preparedBy || undefined,
  });

  return NextResponse.json(project, { status: 201 });
}
