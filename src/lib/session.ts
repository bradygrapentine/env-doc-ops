import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { projectRepo, reportRepo, shareRepo } from "@/lib/db";
import type { Project, Report, ProjectAccessRole } from "@/lib/types";

type Guard<T> = { ok: false; error: NextResponse } | ({ ok: true } & T);

export type AccessMode = "read" | "write";

/**
 * Returns the current session user id, or null if signed out.
 *
 * Test-only backdoor: when AUTH_TEST_USER_ID is set in the environment,
 * skips the Auth.js call and returns it directly. Production code paths
 * never set this. Tests set it via beforeEach.
 */
export async function getSessionUserId(): Promise<string | null> {
  if (process.env.NODE_ENV === "test") {
    return process.env.AUTH_TEST_USER_ID ?? null;
  }
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ?? null;
}

/**
 * Returns 401 if no session, 404 if the project doesn't exist or the user has
 * no access (don't leak existence). For mode='write', sharees get a 403
 * "Read-only access".
 */
export async function requireProjectAccess(
  projectId: string,
  mode: AccessMode,
): Promise<Guard<{ userId: string; project: Project; role: ProjectAccessRole }>> {
  const userId = await getSessionUserId();
  if (!userId)
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const project = projectRepo.get(projectId);
  if (!project) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Project not found" }, { status: 404 }),
    };
  }
  const role = shareRepo.accessRole(projectId, userId);
  if (!role) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Project not found" }, { status: 404 }),
    };
  }
  if (mode === "write" && role !== "owner" && role !== "editor") {
    return {
      ok: false,
      error: NextResponse.json({ error: "Read-only access" }, { status: 403 }),
    };
  }
  return { ok: true, userId, project, role };
}

export async function requireReportAccess(
  reportId: string,
  mode: AccessMode,
): Promise<Guard<{ userId: string; project: Project; report: Report; role: ProjectAccessRole }>> {
  const userId = await getSessionUserId();
  if (!userId)
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const report = reportRepo.get(reportId);
  if (!report)
    return {
      ok: false,
      error: NextResponse.json({ error: "Report not found" }, { status: 404 }),
    };
  const project = projectRepo.get(report.projectId);
  if (!project) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Report not found" }, { status: 404 }),
    };
  }
  const role = shareRepo.accessRole(project.id, userId);
  if (!role) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Report not found" }, { status: 404 }),
    };
  }
  if (mode === "write" && role !== "owner" && role !== "editor") {
    return {
      ok: false,
      error: NextResponse.json({ error: "Read-only access" }, { status: 403 }),
    };
  }
  return { ok: true, userId, project, report, role };
}

/** Back-compat wrapper — write-mode access. */
export async function requireOwnedProject(
  projectId: string,
): Promise<Guard<{ userId: string; project: Project }>> {
  const guard = await requireProjectAccess(projectId, "write");
  if (!guard.ok) return guard;
  return { ok: true, userId: guard.userId, project: guard.project };
}

/** Back-compat wrapper — write-mode access. */
export async function requireOwnedReport(
  reportId: string,
): Promise<Guard<{ userId: string; project: Project; report: Report }>> {
  const guard = await requireReportAccess(reportId, "write");
  if (!guard.ok) return guard;
  return { ok: true, userId: guard.userId, project: guard.project, report: guard.report };
}
