import { NextResponse } from "next/server";
import { projectRepo } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const project = projectRepo.get(params.id);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(project);
}

const EDITABLE = [
  "name",
  "location",
  "jurisdiction",
  "clientName",
  "projectType",
  "developmentSummary",
  "preparedBy",
] as const;
type EditableKey = (typeof EDITABLE)[number];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<Record<EditableKey, string>> = {};
  for (const key of EDITABLE) {
    if (key in body) {
      const v = body[key];
      if (v === null || v === undefined || v === "") {
        // optional fields can be cleared
        if (key === "clientName" || key === "preparedBy") {
          patch[key] = "";
        } else if (typeof v !== "string") {
          return NextResponse.json({ error: `Invalid field: ${key}` }, { status: 400 });
        } else {
          return NextResponse.json({ error: `Field cannot be empty: ${key}` }, { status: 400 });
        }
      } else if (typeof v !== "string") {
        return NextResponse.json({ error: `Invalid field: ${key}` }, { status: 400 });
      } else {
        patch[key] = v;
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Empty patch" }, { status: 400 });
  }

  const updated = projectRepo.update(params.id, patch);
  if (!updated) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ok = projectRepo.delete(params.id);
  if (!ok) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
