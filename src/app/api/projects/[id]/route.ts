import { NextResponse } from "next/server";
import { auditRepo, projectRepo } from "@/lib/db";
import { requireOwnedProject, requireProjectAccess } from "@/lib/session";
import type { ManualInputs } from "@/lib/types";

const MANUAL_INPUT_KEYS = [
  "growthRate",
  "tripGenAssumptions",
  "mitigationNotes",
  "engineerConclusions",
] as const;

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  return NextResponse.json(guard.project);
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
  const guard = await requireOwnedProject(params.id);
  if (!guard.ok) return guard.error;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Partial<Record<EditableKey, string>> & { manualInputs?: ManualInputs | undefined } =
    {};

  if ("manualInputs" in body) {
    const v = body.manualInputs;
    if (v === null || v === undefined) {
      patch.manualInputs = undefined;
    } else if (typeof v !== "object" || Array.isArray(v)) {
      return NextResponse.json({ error: "Invalid field: manualInputs" }, { status: 400 });
    } else {
      const cleaned: ManualInputs = {};
      for (const k of Object.keys(v) as (keyof ManualInputs)[]) {
        if (!(MANUAL_INPUT_KEYS as readonly string[]).includes(k)) continue;
        const val = (v as Record<string, unknown>)[k];
        if (val === undefined || val === null) continue;
        if (typeof val !== "string") {
          return NextResponse.json(
            { error: `Invalid manualInputs.${k}: expected string` },
            { status: 400 },
          );
        }
        cleaned[k] = val;
      }
      patch.manualInputs = cleaned;
    }
  }

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
  auditRepo.log({
    projectId: params.id,
    userId: guard.userId,
    action: "project.update",
    details: { fields: Object.keys(patch) },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const guard = await requireProjectAccess(params.id, "read");
  if (!guard.ok) return guard.error;
  if (guard.role !== "owner") {
    return NextResponse.json({ error: "Owner-only" }, { status: 403 });
  }
  // Log BEFORE delete: audit_log.projectId has no FK so the row survives,
  // but logging first also avoids the (small) ordering risk of inserting
  // into a path the user can no longer see.
  auditRepo.log({
    projectId: params.id,
    userId: guard.userId,
    action: "project.delete",
    details: { name: guard.project.name },
  });
  projectRepo.delete(params.id);
  return new Response(null, { status: 204 });
}
