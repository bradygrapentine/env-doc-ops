import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { projectRepo, reportRepo } from "@/lib/db";
import type { Project, Report } from "@/lib/types";

type Guard<T> = { ok: false; error: NextResponse } | ({ ok: true } & T);

/**
 * Returns the current session user id, or null if signed out.
 *
 * Test-only backdoor: when AUTH_TEST_USER_ID is set in the environment,
 * skips the Auth.js call and returns it directly. Production code paths
 * never set this. Tests set it via beforeEach.
 */
export async function getSessionUserId(): Promise<string | null> {
  // Test backdoor: in NODE_ENV=test we never go through Auth.js — only the
  // env var decides who is signed in. Production never sets NODE_ENV=test.
  if (process.env.NODE_ENV === "test") {
    return process.env.AUTH_TEST_USER_ID ?? null;
  }
  const session = await auth();
  const id = (session?.user as { id?: string } | undefined)?.id;
  return id ?? null;
}

/**
 * Returns 401 if no session, 404 if the project doesn't belong to the user
 * (or doesn't exist — we collapse them to avoid leaking existence). Otherwise
 * returns the project + the session user id.
 */
export async function requireOwnedProject(
  projectId: string,
): Promise<Guard<{ userId: string; project: Project }>> {
  const userId = await getSessionUserId();
  if (!userId)
    return { ok: false, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const project = projectRepo.get(projectId);
  if (!project || project.userId !== userId) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Project not found" }, { status: 404 }),
    };
  }
  return { ok: true, userId, project };
}

export async function requireOwnedReport(
  reportId: string,
): Promise<Guard<{ userId: string; project: Project; report: Report }>> {
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
  if (!project || project.userId !== userId) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Report not found" }, { status: 404 }),
    };
  }
  return { ok: true, userId, project, report };
}
