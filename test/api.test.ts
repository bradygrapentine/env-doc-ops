import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { resetDb } from "./db";
import { jsonReq, textReq, emptyReq, nextJsonReq, nextEmptyReq } from "./routes";
import { userRepo } from "@/lib/db";

import { POST as createProject, GET as listProjects } from "@/app/api/projects/route";
import {
  GET as getProject,
  PATCH as patchProject,
  DELETE as deleteProject,
} from "@/app/api/projects/[id]/route";
import { POST as uploadCsv } from "@/app/api/projects/[id]/traffic-data/route";
import { POST as addRowRoute } from "@/app/api/projects/[id]/traffic-data/rows/route";
import {
  PATCH as patchRowRoute,
  DELETE as deleteRowRoute,
} from "@/app/api/projects/[id]/traffic-data/rows/[rowId]/route";
import { POST as previewCsv } from "@/app/api/projects/[id]/traffic-data/preview/route";
import { POST as generateReport } from "@/app/api/projects/[id]/generate-report/route";
import { POST as previewReport } from "@/app/api/projects/[id]/generate-report/preview/route";
import { GET as getReport } from "@/app/api/reports/[id]/route";
import {
  PATCH as patchSection,
  DELETE as deleteSection,
} from "@/app/api/reports/[id]/sections/[sectionId]/route";
import { POST as addCustomSection } from "@/app/api/reports/[id]/sections/route";
import { PATCH as reorderSections } from "@/app/api/reports/[id]/sections/order/route";
import { POST as regenerateSection } from "@/app/api/reports/[id]/sections/[sectionId]/regenerate/route";
import { POST as exportDocx } from "@/app/api/reports/[id]/export-docx/route";
import { POST as exportPdf } from "@/app/api/reports/[id]/export-pdf/route";
import { POST as signupRoute } from "@/app/api/auth/signup/route";
import { POST as changeEmailRoute } from "@/app/api/auth/change-email/route";
import {
  GET as peekEmailChangeRoute,
  POST as confirmEmailChangeRoute,
} from "@/app/api/auth/confirm-email-change/route";
import { DELETE as deleteAccountRoute } from "@/app/api/auth/account/route";
import { GET as listAuditRoute } from "@/app/api/projects/[id]/audit/route";
import { POST as changePasswordRoute } from "@/app/api/auth/change-password/route";
import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordRoute } from "@/app/api/auth/reset-password/route";
import { POST as sendVerificationRoute } from "@/app/api/auth/send-verification/route";
import { GET as verifyEmailRoute } from "@/app/api/auth/verify-email/route";
import { tokenRepo } from "@/lib/tokens";
import { getCapturedEmails, clearCapturedEmails } from "@/lib/email";
import { _resetForTest as _resetRateLimit } from "@/lib/rate-limit";
import { GET as listShares, POST as addShare } from "@/app/api/projects/[id]/shares/route";
import {
  PATCH as patchShare,
  DELETE as removeShare,
} from "@/app/api/projects/[id]/shares/[userId]/route";

const SAMPLE_CSV = fs.readFileSync(
  path.join(process.cwd(), "sample_data/sample_traffic_counts.csv"),
  "utf8",
);

const PROJECT_BODY = {
  name: "Test",
  location: "Anywhere",
  jurisdiction: "Test City",
  projectType: "Mixed-use",
  developmentSummary: "Summary",
};

async function makeProject() {
  const res = await createProject(jsonReq("POST", PROJECT_BODY));
  return await res.json();
}

async function makeProjectWithRows() {
  const project = await makeProject();
  await uploadCsv(textReq("POST", SAMPLE_CSV), { params: { id: project.id } });
  return project;
}

async function makeReport() {
  const project = await makeProjectWithRows();
  const res = await generateReport(emptyReq("POST"), { params: { id: project.id } });
  const body = await res.json();
  return { project, reportId: body.reportId as string, sections: body.sections };
}

function seedUser(email = "test@example.com"): string {
  const u = userRepo.create({
    email,
    name: "Test User",
    passwordHash: bcrypt.hashSync("password123", 4),
  });
  return u.id;
}

beforeEach(() => {
  resetDb();
  clearCapturedEmails();
  _resetRateLimit();
  process.env.AUTH_TEST_USER_ID = seedUser();
});

afterEach(() => {
  delete process.env.AUTH_TEST_USER_ID;
});

describe("POST /api/projects", () => {
  it("creates a project with valid body", async () => {
    const res = await createProject(jsonReq("POST", PROJECT_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.name).toBe("Test");
  });

  it("rejects when name is missing", async () => {
    const { name: _, ...bad } = PROJECT_BODY;
    void _;
    const res = await createProject(jsonReq("POST", bad));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/projects", () => {
  it("returns the list", async () => {
    await makeProject();
    const res = await listProjects();
    expect(res.status).toBe(200);
    const list = await res.json();
    expect(list.length).toBe(1);
  });
});

describe("GET /api/projects/:id", () => {
  it("returns 200 for existing project", async () => {
    const p = await makeProject();
    const res = await getProject(emptyReq("GET"), { params: { id: p.id } });
    expect(res.status).toBe(200);
  });

  it("returns 404 for unknown id", async () => {
    const res = await getProject(emptyReq("GET"), { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/projects/:id", () => {
  it("updates editable fields with a partial body", async () => {
    const p = await makeProject();
    const res = await patchProject(jsonReq("PATCH", { name: "Renamed", location: "New City" }), {
      params: { id: p.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Renamed");
    expect(body.location).toBe("New City");
    expect(body.jurisdiction).toBe(p.jurisdiction);

    const get = await getProject(emptyReq("GET"), { params: { id: p.id } });
    const fresh = await get.json();
    expect(fresh.name).toBe("Renamed");
    expect(fresh.location).toBe("New City");
  });

  it("returns 400 on empty body", async () => {
    const p = await makeProject();
    const res = await patchProject(jsonReq("PATCH", {}), { params: { id: p.id } });
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown id", async () => {
    const res = await patchProject(jsonReq("PATCH", { name: "X" }), { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });

  it("accepts manualInputs object and round-trips via GET", async () => {
    const p = await makeProject();
    const res = await patchProject(
      jsonReq("PATCH", { manualInputs: { tripGenAssumptions: "Some text" } }),
      { params: { id: p.id } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.manualInputs).toEqual({ tripGenAssumptions: "Some text" });

    const get = await getProject(emptyReq("GET"), { params: { id: p.id } });
    const fresh = await get.json();
    expect(fresh.manualInputs).toEqual({ tripGenAssumptions: "Some text" });
  });

  it("rejects manualInputs with a non-string value", async () => {
    const p = await makeProject();
    const res = await patchProject(jsonReq("PATCH", { manualInputs: { growthRate: 42 } }), {
      params: { id: p.id },
    });
    expect(res.status).toBe(400);
  });

  it("ignores attempts to change id or createdAt", async () => {
    const p = await makeProject();
    const res = await patchProject(
      jsonReq("PATCH", { id: "hacked", createdAt: "2000-01-01T00:00:00Z", name: "New Name" }),
      { params: { id: p.id } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(p.id);
    expect(body.createdAt).toBe(p.createdAt);
    expect(body.name).toBe("New Name");
  });
});

describe("DELETE /api/projects/:id", () => {
  it("deletes an existing project (204) and subsequent GET is 404", async () => {
    const p = await makeProject();
    const res = await deleteProject(emptyReq("DELETE"), { params: { id: p.id } });
    expect(res.status).toBe(204);
    const get = await getProject(emptyReq("GET"), { params: { id: p.id } });
    expect(get.status).toBe(404);
  });

  it("cascades to reports", async () => {
    const { project, reportId } = await makeReport();
    const del = await deleteProject(emptyReq("DELETE"), { params: { id: project.id } });
    expect(del.status).toBe(204);
    const reportRes = await getReport(emptyReq("GET"), { params: { id: reportId } });
    expect(reportRes.status).toBe(404);
  });

  it("returns 404 for unknown id", async () => {
    const res = await deleteProject(emptyReq("DELETE"), { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/projects/:id/traffic-data", () => {
  it("imports valid CSV", async () => {
    const p = await makeProject();
    const res = await uploadCsv(textReq("POST", SAMPLE_CSV), { params: { id: p.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rowsImported).toBe(8);
    expect(body.intersections).toContain("Main St & 1st Ave");
  });

  it("rejects CSV with missing column", async () => {
    const p = await makeProject();
    const res = await uploadCsv(textReq("POST", "intersection,period\nMain,AM"), {
      params: { id: p.id },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/projects/:id/traffic-data/rows", () => {
  const validRow = {
    intersection: "Main & 1st",
    period: "AM",
    approach: "N",
    inbound: 1,
    outbound: 2,
    total: 3,
  };

  it("inserts a valid row and the CSV preview reflects it", async () => {
    const p = await makeProject();
    const res = await addRowRoute(jsonReq("POST", { row: validRow }), {
      params: { id: p.id },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.projectId).toBe(p.id);
    expect(body.intersection).toBe("Main & 1st");

    const { trafficRepo } = await import("@/lib/db");
    const list = trafficRepo.listByProject(p.id);
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(body.id);
  });

  it("rejects an invalid row with 400 and populated issues", async () => {
    const p = await makeProject();
    const res = await addRowRoute(
      jsonReq("POST", { row: { ...validRow, period: "RUSH", total: "abc" } }),
      { params: { id: p.id } },
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThanOrEqual(2);
  });

  it("returns 404 for a project owned by another user", async () => {
    const p = await makeProject();
    const userBId = seedUser("rows-other@example.com");
    process.env.AUTH_TEST_USER_ID = userBId;
    const res = await addRowRoute(jsonReq("POST", { row: validRow }), {
      params: { id: p.id },
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/projects/:id/traffic-data/rows/:rowId", () => {
  const validRow = {
    intersection: "Main & 1st",
    period: "AM",
    approach: "N",
    inbound: 1,
    outbound: 2,
    total: 3,
  };

  it("updates a row (happy path), 404s cross-user, 404s row from a different project", async () => {
    const p = await makeProject();
    const add = await addRowRoute(jsonReq("POST", { row: validRow }), {
      params: { id: p.id },
    });
    const created = await add.json();

    // Happy path.
    const ok = await patchRowRoute(jsonReq("PATCH", { inbound: 99 }), {
      params: { id: p.id, rowId: created.id },
    });
    expect(ok.status).toBe(200);
    const updated = await ok.json();
    expect(updated.inbound).toBe(99);
    expect(updated.outbound).toBe(2);

    // Same user, different project: row not in that project → 404.
    const otherProject = await makeProject();
    const cross = await patchRowRoute(jsonReq("PATCH", { inbound: 1 }), {
      params: { id: otherProject.id, rowId: created.id },
    });
    expect(cross.status).toBe(404);

    // Cross-user: 404 from project guard.
    const userBId = seedUser("patch-other@example.com");
    process.env.AUTH_TEST_USER_ID = userBId;
    const xuser = await patchRowRoute(jsonReq("PATCH", { inbound: 1 }), {
      params: { id: p.id, rowId: created.id },
    });
    expect(xuser.status).toBe(404);
  });
});

describe("DELETE /api/projects/:id/traffic-data/rows/:rowId", () => {
  const validRow = {
    intersection: "Main & 1st",
    period: "AM",
    approach: "N",
    inbound: 1,
    outbound: 2,
    total: 3,
  };

  it("deletes a row (204) and returns 404 for unknown row", async () => {
    const p = await makeProject();
    const add = await addRowRoute(jsonReq("POST", { row: validRow }), {
      params: { id: p.id },
    });
    const created = await add.json();

    const ok = await deleteRowRoute(emptyReq("DELETE"), {
      params: { id: p.id, rowId: created.id },
    });
    expect(ok.status).toBe(204);

    const notFound = await deleteRowRoute(emptyReq("DELETE"), {
      params: { id: p.id, rowId: "nope" },
    });
    expect(notFound.status).toBe(404);
  });
});

describe("POST /api/projects/:id/traffic-data/preview", () => {
  const HEADER = "intersection,period,approach,inbound,outbound,total";

  it("returns parsed result for a valid CSV", async () => {
    const p = await makeProject();
    const res = await previewCsv(textReq("POST", SAMPLE_CSV), { params: { id: p.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.validRows).toHaveLength(8);
    expect(body.invalidRows).toHaveLength(0);
  });

  it("returns 200 with invalidRows populated when a row is bad (no failure)", async () => {
    const p = await makeProject();
    const csv = [HEADER, "Main,AM,N,1,2,3", "Bad,RUSH,N,1,2,abc"].join("\n");
    const res = await previewCsv(textReq("POST", csv), { params: { id: p.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.validRows).toHaveLength(1);
    expect(body.invalidRows).toHaveLength(1);
    expect(body.invalidRows[0].issues.length).toBeGreaterThan(0);
    expect(body.invalidRows[0].row).toBe(3);
  });

  it("returns 400 when a required column is missing", async () => {
    const p = await makeProject();
    const res = await previewCsv(textReq("POST", "intersection,period\nMain,AM"), {
      params: { id: p.id },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing required columns/i);
  });
});

describe("POST /api/projects/:id/generate-report", () => {
  it("generates 8 sections when rows exist", async () => {
    const project = await makeProjectWithRows();
    const res = await generateReport(emptyReq("POST"), { params: { id: project.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reportId).toBeTruthy();
    expect(body.sections).toHaveLength(8);
    expect(body.refreshed).toHaveLength(8);
    expect(body.preserved).toHaveLength(0);
  });

  it("preserves edited sections on regenerate", async () => {
    const { project, reportId } = await makeReport();
    await patchSection(jsonReq("PATCH", { content: "USER EDIT" }), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    const res = await generateReport(emptyReq("POST"), { params: { id: project.id } });
    const body = await res.json();
    expect(body.preserved).toContain("executive-summary");
    expect(body.refreshed).not.toContain("executive-summary");
    const exec = body.sections.find((s: { id: string }) => s.id === "executive-summary");
    expect(exec.content).toBe("USER EDIT");
  });

  it("preserves reviewed sections even if unedited", async () => {
    const { project, reportId } = await makeReport();
    await patchSection(jsonReq("PATCH", { status: "reviewed" }), {
      params: { id: reportId, sectionId: "conclusion" },
    });
    const res = await generateReport(emptyReq("POST"), { params: { id: project.id } });
    const body = await res.json();
    expect(body.preserved).toContain("conclusion");
    const conclusion = body.sections.find((s: { id: string }) => s.id === "conclusion");
    expect(conclusion.status).toBe("reviewed");
  });

  it("rejects when no rows uploaded", async () => {
    const project = await makeProject();
    const res = await generateReport(emptyReq("POST"), { params: { id: project.id } });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/projects/:id/generate-report/preview", () => {
  it("returns refreshed/preserved buckets without writing", async () => {
    const { project, reportId } = await makeReport();
    await patchSection(jsonReq("PATCH", { content: "USER EDIT" }), {
      params: { id: reportId, sectionId: "executive-summary" },
    });

    const before = await getReport(emptyReq("GET"), { params: { id: reportId } });
    const beforeBody = await before.json();

    const res = await previewReport(emptyReq("POST"), { params: { id: project.id } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.preserved.map((s: { id: string }) => s.id)).toContain("executive-summary");
    expect(body.refreshed.map((s: { id: string }) => s.id)).not.toContain("executive-summary");

    const after = await getReport(emptyReq("GET"), { params: { id: reportId } });
    const afterBody = await after.json();
    expect(afterBody.updatedAt).toBe(beforeBody.updatedAt);
  });
});

describe("GET /api/reports/:id", () => {
  it("returns the report", async () => {
    const { reportId } = await makeReport();
    const res = await getReport(emptyReq("GET"), { params: { id: reportId } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sections).toHaveLength(8);
  });

  it("returns 404 for unknown report", async () => {
    const res = await getReport(emptyReq("GET"), { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/reports/:id/sections/:sectionId", () => {
  it("updates content and status", async () => {
    const { reportId } = await makeReport();
    const res = await patchSection(jsonReq("PATCH", { content: "EDITED", status: "reviewed" }), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const section = body.sections.find((s: { id: string }) => s.id === "executive-summary");
    expect(section.content).toBe("EDITED");
    expect(section.status).toBe("reviewed");
  });

  it("rejects an invalid status", async () => {
    const { reportId } = await makeReport();
    const res = await patchSection(jsonReq("PATCH", { status: "bogus" }), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/reports/:id/sections/:sectionId/regenerate", () => {
  it("replaces edited section with fresh template output and resets status to draft", async () => {
    const { reportId, sections } = await makeReport();
    // Edit two sections first.
    await patchSection(jsonReq("PATCH", { content: "USER EDIT", status: "reviewed" }), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    await patchSection(jsonReq("PATCH", { content: "OTHER EDIT", status: "final" }), {
      params: { id: reportId, sectionId: "project-description" },
    });
    const original = sections.find((s: { id: string }) => s.id === "executive-summary");

    const res = await regenerateSection(emptyReq("POST"), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const target = body.sections.find((s: { id: string }) => s.id === "executive-summary");
    expect(target.content).toBe(original.content);
    expect(target.status).toBe("draft");
    // Other edited section untouched.
    const other = body.sections.find((s: { id: string }) => s.id === "project-description");
    expect(other.content).toBe("OTHER EDIT");
    expect(other.status).toBe("final");
  });

  it("returns 404 for unknown report id", async () => {
    const res = await regenerateSection(emptyReq("POST"), {
      params: { id: "nope", sectionId: "executive-summary" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 with template message for unknown section id", async () => {
    const { reportId } = await makeReport();
    const res = await regenerateSection(emptyReq("POST"), {
      params: { id: reportId, sectionId: "not-a-real-section" },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("Section not found in current template");
  });

  it("returns 400 when project has no traffic rows", async () => {
    const { reportId, project } = await makeReport();
    // Wipe rows.
    const { trafficRepo } = await import("@/lib/db");
    trafficRepo.replaceForProject(project.id, []);
    const res = await regenerateSection(emptyReq("POST"), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 for cross-user report (no existence leak)", async () => {
    const { reportId } = await makeReport();
    const userBId = seedUser("regen-b@example.com");
    process.env.AUTH_TEST_USER_ID = userBId;
    const res = await regenerateSection(emptyReq("POST"), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 when unauthenticated", async () => {
    const { reportId } = await makeReport();
    delete process.env.AUTH_TEST_USER_ID;
    const res = await regenerateSection(emptyReq("POST"), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/reports/:id/export-docx", () => {
  it("returns a docx attachment", async () => {
    const { reportId } = await makeReport();
    const res = await exportDocx(emptyReq("POST"), { params: { id: reportId } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("officedocument.wordprocessingml");
    const ab = await res.arrayBuffer();
    const u8 = new Uint8Array(ab);
    expect(u8[0]).toBe(0x50);
    expect(u8[1]).toBe(0x4b);
  });

  it("returns 404 for unknown report", async () => {
    const res = await exportDocx(emptyReq("POST"), { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/reports/:id/export-pdf", () => {
  it("returns a pdf attachment", async () => {
    const { reportId } = await makeReport();
    const res = await exportPdf(emptyReq("POST"), { params: { id: reportId } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/pdf");
    const ab = await res.arrayBuffer();
    const u8 = new Uint8Array(ab);
    expect(u8[0]).toBe(0x25);
    expect(u8[1]).toBe(0x50);
    expect(u8[2]).toBe(0x44);
    expect(u8[3]).toBe(0x46);
  });

  it("returns 404 for unknown report", async () => {
    const res = await exportPdf(emptyReq("POST"), { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/auth/signup", () => {
  it("creates a user and returns id/email/name", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    resetDb();
    const res = await signupRoute(
      jsonReq("POST", { email: "alice@example.com", password: "password123", name: "Alice" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.email).toBe("alice@example.com");
    expect(body.name).toBe("Alice");
    expect(body.claimed).toBe(0);
  });

  it("rejects short passwords", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    resetDb();
    const res = await signupRoute(
      jsonReq("POST", { email: "a@b.c", password: "short", name: "A" }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects duplicate emails", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    resetDb();
    const body = { email: "dup@example.com", password: "password123", name: "Dup" };
    const r1 = await signupRoute(jsonReq("POST", body));
    expect(r1.status).toBe(200);
    const r2 = await signupRoute(jsonReq("POST", body));
    expect(r2.status).toBe(409);
  });

  it("first user claims orphan projects", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    resetDb();
    // Create an orphan project (userId=null) by going through repo directly.
    const { projectRepo } = await import("@/lib/db");
    projectRepo.create({
      userId: null,
      name: "Legacy",
      location: "X",
      jurisdiction: "Y",
      projectType: "P",
      developmentSummary: "S",
    });
    const res = await signupRoute(
      jsonReq("POST", { email: "first@example.com", password: "password123", name: "First" }),
    );
    const body = await res.json();
    expect(body.claimed).toBe(1);

    process.env.AUTH_TEST_USER_ID = body.id;
    const list = await listProjects();
    const projects = await list.json();
    expect(projects).toHaveLength(1);
    expect(projects[0].userId).toBe(body.id);
  });
});

describe("POST /api/auth/change-password", () => {
  it("rotates the password on valid input", async () => {
    // Replace the seeded user with one whose current password is known.
    resetDb();
    const u = userRepo.create({
      email: "cp@example.com",
      name: "CP",
      passwordHash: bcrypt.hashSync("oldpassword", 4),
    });
    process.env.AUTH_TEST_USER_ID = u.id;

    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "oldpassword", newPassword: "newpassword1" }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    const updated = userRepo.findByEmail("cp@example.com");
    expect(updated).toBeTruthy();
    expect(bcrypt.compareSync("newpassword1", updated!.passwordHash)).toBe(true);
  });

  it("rejects wrong currentPassword with 401", async () => {
    resetDb();
    const u = userRepo.create({
      email: "cp2@example.com",
      name: "CP2",
      passwordHash: bcrypt.hashSync("oldpassword", 4),
    });
    process.env.AUTH_TEST_USER_ID = u.id;

    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "WRONG", newPassword: "newpassword1" }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Current password is incorrect");
  });

  it("rejects newPassword shorter than 8 chars with 400", async () => {
    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "password123", newPassword: "short" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 with no session", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "password123", newPassword: "newpassword1" }),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when currentPassword is missing", async () => {
    const res = await changePasswordRoute(jsonReq("POST", { newPassword: "newpassword1" }));
    expect(res.status).toBe(400);
  });
});

describe("Authorization: unsigned requests", () => {
  it("GET /api/projects returns 401 with no session", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await listProjects();
    expect(res.status).toBe(401);
  });

  it("POST /api/projects returns 401 with no session", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await createProject(jsonReq("POST", PROJECT_BODY));
    expect(res.status).toBe(401);
  });

  it("GET /api/projects/:id returns 401 with no session", async () => {
    const projectId = (await makeProject()).id;
    delete process.env.AUTH_TEST_USER_ID;
    const res = await getProject(emptyReq("GET"), { params: { id: projectId } });
    expect(res.status).toBe(401);
  });
});

describe("PATCH /api/reports/:id/sections/order", () => {
  it("reorders sections (happy path)", async () => {
    const { reportId, sections } = await makeReport();
    const ids: string[] = sections.map((s: { id: string }) => s.id);
    const reversed = [...ids].reverse();
    const res = await reorderSections(jsonReq("PATCH", { orderedIds: reversed }), {
      params: { id: reportId },
    });
    expect(res.status).toBe(200);
    const after = await getReport(emptyReq("GET"), { params: { id: reportId } });
    const body = await after.json();
    const got = body.sections.map((s: { id: string }) => s.id);
    expect(got).toEqual(reversed);
    body.sections.forEach((s: { order: number }, i: number) => expect(s.order).toBe(i + 1));
  });

  it("rejects mismatched id set with 400", async () => {
    const { reportId, sections } = await makeReport();
    const ids: string[] = sections.map((s: { id: string }) => s.id);
    const bad = [...ids.slice(1), "totally-fake-id"];
    const res = await reorderSections(jsonReq("PATCH", { orderedIds: bad }), {
      params: { id: reportId },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/existing section ids/i);
  });

  it("returns 404 cross-user", async () => {
    const { reportId, sections } = await makeReport();
    process.env.AUTH_TEST_USER_ID = seedUser("order-b@example.com");
    const res = await reorderSections(
      jsonReq("PATCH", { orderedIds: sections.map((s: { id: string }) => s.id) }),
      { params: { id: reportId } },
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 unauth", async () => {
    const { reportId, sections } = await makeReport();
    delete process.env.AUTH_TEST_USER_ID;
    const res = await reorderSections(
      jsonReq("PATCH", { orderedIds: sections.map((s: { id: string }) => s.id) }),
      { params: { id: reportId } },
    );
    expect(res.status).toBe(401);
  });
});

describe("POST /api/reports/:id/sections", () => {
  it("adds a custom section with monotonically next order", async () => {
    const { reportId } = await makeReport();
    const res = await addCustomSection(jsonReq("POST", { title: "My custom", content: "hi" }), {
      params: { id: reportId },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kind).toBe("custom");
    expect(body.status).toBe("draft");
    expect(body.title).toBe("My custom");
    expect(body.order).toBe(9);
    expect(body.machineBaseline).toBe("hi");

    const after = await getReport(emptyReq("GET"), { params: { id: reportId } });
    const r = await after.json();
    expect(r.sections).toHaveLength(9);
  });

  it("rejects empty title with 400", async () => {
    const { reportId } = await makeReport();
    const res = await addCustomSection(jsonReq("POST", { title: "   " }), {
      params: { id: reportId },
    });
    expect(res.status).toBe(400);
  });

  it("returns 404 cross-user", async () => {
    const { reportId } = await makeReport();
    process.env.AUTH_TEST_USER_ID = seedUser("add-b@example.com");
    const res = await addCustomSection(jsonReq("POST", { title: "X" }), {
      params: { id: reportId },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 unauth", async () => {
    const { reportId } = await makeReport();
    delete process.env.AUTH_TEST_USER_ID;
    const res = await addCustomSection(jsonReq("POST", { title: "X" }), {
      params: { id: reportId },
    });
    expect(res.status).toBe(401);
  });
});

describe("DELETE /api/reports/:id/sections/:sectionId", () => {
  it("deletes a custom section (204) and excludes from GET", async () => {
    const { reportId } = await makeReport();
    const addRes = await addCustomSection(jsonReq("POST", { title: "tmp", content: "" }), {
      params: { id: reportId },
    });
    const added = await addRes.json();
    const del = await deleteSection(emptyReq("DELETE"), {
      params: { id: reportId, sectionId: added.id },
    });
    expect(del.status).toBe(204);
    const after = await getReport(emptyReq("GET"), { params: { id: reportId } });
    const body = await after.json();
    expect(body.sections.find((s: { id: string }) => s.id === added.id)).toBeUndefined();
  });

  it("refuses to delete a standard section with 400", async () => {
    const { reportId } = await makeReport();
    const res = await deleteSection(emptyReq("DELETE"), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Cannot delete a standard section");
  });

  it("returns 404 for unknown section id", async () => {
    const { reportId } = await makeReport();
    const res = await deleteSection(emptyReq("DELETE"), {
      params: { id: reportId, sectionId: "no-such-section" },
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 cross-user", async () => {
    const { reportId } = await makeReport();
    const addRes = await addCustomSection(jsonReq("POST", { title: "tmp" }), {
      params: { id: reportId },
    });
    const added = await addRes.json();
    process.env.AUTH_TEST_USER_ID = seedUser("del-b@example.com");
    const res = await deleteSection(emptyReq("DELETE"), {
      params: { id: reportId, sectionId: added.id },
    });
    expect(res.status).toBe(404);
  });

  it("returns 401 unauth", async () => {
    const { reportId } = await makeReport();
    delete process.env.AUTH_TEST_USER_ID;
    const res = await deleteSection(emptyReq("DELETE"), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(res.status).toBe(401);
  });
});

describe("Per-project sharing", () => {
  it("owner shares; sharee can GET and sees in list with role=reader", async () => {
    const project = await makeProject();
    const ownerId = process.env.AUTH_TEST_USER_ID!;
    const shareeId = seedUser("share-a@example.com");

    const inv = await addShare(jsonReq("POST", { email: "share-a@example.com" }), {
      params: { id: project.id },
    });
    expect(inv.status).toBe(200);

    process.env.AUTH_TEST_USER_ID = shareeId;
    const get = await getProject(emptyReq("GET"), { params: { id: project.id } });
    expect(get.status).toBe(200);

    const list = await listProjects();
    const body = await list.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe(project.id);
    expect(body[0].role).toBe("reader");

    process.env.AUTH_TEST_USER_ID = ownerId;
  });

  it("sharee PATCH project → 403 with Read-only access", async () => {
    const project = await makeProject();
    const shareeId = seedUser("share-b@example.com");
    await addShare(jsonReq("POST", { email: "share-b@example.com" }), {
      params: { id: project.id },
    });
    process.env.AUTH_TEST_USER_ID = shareeId;
    const res = await patchProject(jsonReq("PATCH", { name: "Hacked" }), {
      params: { id: project.id },
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("Read-only access");
  });

  it("sharee DELETE project → 403", async () => {
    const project = await makeProject();
    const shareeId = seedUser("share-c@example.com");
    await addShare(jsonReq("POST", { email: "share-c@example.com" }), {
      params: { id: project.id },
    });
    process.env.AUTH_TEST_USER_ID = shareeId;
    const res = await deleteProject(emptyReq("DELETE"), { params: { id: project.id } });
    expect(res.status).toBe(403);
  });

  it("sharee mutating endpoints all return 403", async () => {
    const { project, reportId } = await makeReport();
    const shareeId = seedUser("share-d@example.com");
    await addShare(jsonReq("POST", { email: "share-d@example.com" }), {
      params: { id: project.id },
    });
    process.env.AUTH_TEST_USER_ID = shareeId;

    const csv = await uploadCsv(textReq("POST", SAMPLE_CSV), { params: { id: project.id } });
    expect(csv.status).toBe(403);

    const gen = await generateReport(emptyReq("POST"), { params: { id: project.id } });
    expect(gen.status).toBe(403);

    const sec = await patchSection(jsonReq("PATCH", { content: "X" }), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(sec.status).toBe(403);

    const regen = await regenerateSection(emptyReq("POST"), {
      params: { id: reportId, sectionId: "executive-summary" },
    });
    expect(regen.status).toBe(403);
  });

  it("sharee CAN export DOCX and PDF", async () => {
    const { project, reportId } = await makeReport();
    const shareeId = seedUser("share-e@example.com");
    await addShare(jsonReq("POST", { email: "share-e@example.com" }), {
      params: { id: project.id },
    });
    process.env.AUTH_TEST_USER_ID = shareeId;

    const docx = await exportDocx(emptyReq("POST"), { params: { id: reportId } });
    expect(docx.status).toBe(200);
    const pdf = await exportPdf(emptyReq("POST"), { params: { id: reportId } });
    expect(pdf.status).toBe(200);
  });

  it("non-sharee, non-owner gets 404 on GET", async () => {
    const project = await makeProject();
    seedUser("stranger@example.com");
    process.env.AUTH_TEST_USER_ID = userRepo.findByEmail("stranger@example.com")!.id;
    const res = await getProject(emptyReq("GET"), { params: { id: project.id } });
    expect(res.status).toBe(404);
  });

  it("owner DELETE share → sharee then 404", async () => {
    const project = await makeProject();
    const shareeId = seedUser("share-f@example.com");
    await addShare(jsonReq("POST", { email: "share-f@example.com" }), {
      params: { id: project.id },
    });
    const ownerId = process.env.AUTH_TEST_USER_ID!;
    const del = await removeShare(emptyReq("DELETE"), {
      params: { id: project.id, userId: shareeId },
    });
    expect(del.status).toBe(204);
    process.env.AUTH_TEST_USER_ID = shareeId;
    const get = await getProject(emptyReq("GET"), { params: { id: project.id } });
    expect(get.status).toBe(404);
    process.env.AUTH_TEST_USER_ID = ownerId;
  });

  it("POST shares for non-existent email → 404", async () => {
    const project = await makeProject();
    const res = await addShare(jsonReq("POST", { email: "ghost@example.com" }), {
      params: { id: project.id },
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe("No user with that email");
  });

  it("POST shares with the owner's own email → 400", async () => {
    const project = await makeProject();
    const res = await addShare(jsonReq("POST", { email: "test@example.com" }), {
      params: { id: project.id },
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Owner is already implicit");
  });

  it("GET shares as sharee → 403", async () => {
    const project = await makeProject();
    const shareeId = seedUser("share-g@example.com");
    await addShare(jsonReq("POST", { email: "share-g@example.com" }), {
      params: { id: project.id },
    });
    process.env.AUTH_TEST_USER_ID = shareeId;
    const res = await listShares(emptyReq("GET"), { params: { id: project.id } });
    expect(res.status).toBe(403);
  });

  it("POST shares is idempotent on duplicate", async () => {
    const project = await makeProject();
    seedUser("dup-share@example.com");
    const r1 = await addShare(jsonReq("POST", { email: "dup-share@example.com" }), {
      params: { id: project.id },
    });
    expect(r1.status).toBe(200);
    const r2 = await addShare(jsonReq("POST", { email: "dup-share@example.com" }), {
      params: { id: project.id },
    });
    expect(r2.status).toBe(200);
    const list = await listShares(emptyReq("GET"), { params: { id: project.id } });
    const body = await list.json();
    expect(body).toHaveLength(1);
  });

  it("editor share can mutate the project (PATCH name)", async () => {
    const project = await makeProject();
    const editorId = seedUser("editor@example.com");
    const ownerId = process.env.AUTH_TEST_USER_ID!;
    const inv = await addShare(jsonReq("POST", { email: "editor@example.com", role: "editor" }), {
      params: { id: project.id },
    });
    expect(inv.status).toBe(200);
    expect((await inv.json()).role).toBe("editor");
    process.env.AUTH_TEST_USER_ID = editorId;
    const res = await patchProject(jsonReq("PATCH", { name: "Renamed by editor" }), {
      params: { id: project.id },
    });
    expect(res.status).toBe(200);
    process.env.AUTH_TEST_USER_ID = ownerId;
  });

  it("editor cannot manage shares or delete the project", async () => {
    const project = await makeProject();
    const editorId = seedUser("editor2@example.com");
    const ownerId = process.env.AUTH_TEST_USER_ID!;
    await addShare(jsonReq("POST", { email: "editor2@example.com", role: "editor" }), {
      params: { id: project.id },
    });
    process.env.AUTH_TEST_USER_ID = editorId;
    const list = await listShares(emptyReq("GET"), { params: { id: project.id } });
    expect(list.status).toBe(403);
    const del = await deleteProject(emptyReq("DELETE"), { params: { id: project.id } });
    expect(del.status).toBe(403);
    process.env.AUTH_TEST_USER_ID = ownerId;
  });

  it("PATCH share role promotes reader to editor", async () => {
    const project = await makeProject();
    const shareeId = seedUser("promoteable@example.com");
    await addShare(jsonReq("POST", { email: "promoteable@example.com" }), {
      params: { id: project.id },
    });
    const res = await patchShare(jsonReq("PATCH", { role: "editor" }), {
      params: { id: project.id, userId: shareeId },
    });
    expect(res.status).toBe(200);
    const list = await listShares(emptyReq("GET"), { params: { id: project.id } });
    const body = await list.json();
    expect(body[0].role).toBe("editor");
  });

  it("PATCH share role rejects invalid role", async () => {
    const project = await makeProject();
    const shareeId = seedUser("invalid-role@example.com");
    await addShare(jsonReq("POST", { email: "invalid-role@example.com" }), {
      params: { id: project.id },
    });
    const res = await patchShare(jsonReq("PATCH", { role: "admin" }), {
      params: { id: project.id, userId: shareeId },
    });
    expect(res.status).toBe(400);
  });

  it("POST shares rejects invalid role string", async () => {
    const project = await makeProject();
    seedUser("rolepick@example.com");
    const res = await addShare(jsonReq("POST", { email: "rolepick@example.com", role: "admin" }), {
      params: { id: project.id },
    });
    expect(res.status).toBe(400);
  });
  it("POST shares rejects missing email", async () => {
    const project = await makeProject();
    const res = await addShare(jsonReq("POST", {}), { params: { id: project.id } });
    expect(res.status).toBe(400);
  });

  it("POST shares with explicit role=editor adds as editor", async () => {
    const project = await makeProject();
    seedUser("first-editor@example.com");
    const res = await addShare(
      jsonReq("POST", { email: "first-editor@example.com", role: "editor" }),
      { params: { id: project.id } },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("editor");
  });
});

describe("Cross-user isolation", () => {
  it("user A cannot see user B's project", async () => {
    const projectA = await makeProject();
    const userBId = seedUser("b@example.com");
    process.env.AUTH_TEST_USER_ID = userBId;
    const list = await listProjects();
    expect(await list.json()).toEqual([]);
    const get = await getProject(emptyReq("GET"), { params: { id: projectA.id } });
    expect(get.status).toBe(404);
  });

  it("user A cannot delete user B's project", async () => {
    const projectA = await makeProject();
    const userBId = seedUser("b2@example.com");
    process.env.AUTH_TEST_USER_ID = userBId;
    const del = await deleteProject(emptyReq("DELETE"), { params: { id: projectA.id } });
    expect(del.status).toBe(404);
  });
});

describe("Password reset + email verification", () => {
  function emailFromUserId(userId: string): string {
    return userRepo.findById(userId)!.email;
  }

  it("forgot-password for an existing user returns 200 and sends one email", async () => {
    const email = emailFromUserId(process.env.AUTH_TEST_USER_ID!);
    const res = await forgotPasswordRoute(nextJsonReq("POST", { email }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    const emails = getCapturedEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe(email);
    expect(emails[0].body).toContain("/reset-password?token=");
  });

  it("forgot-password for a non-existent email returns 200 and sends zero emails", async () => {
    const res = await forgotPasswordRoute(nextJsonReq("POST", { email: "nobody@example.com" }));
    expect(res.status).toBe(200);
    expect(getCapturedEmails()).toHaveLength(0);
  });

  it("reset-password with a valid token rotates the password", async () => {
    const userId = process.env.AUTH_TEST_USER_ID!;
    const email = emailFromUserId(userId);
    const { token } = tokenRepo.createReset(userId);
    const res = await resetPasswordRoute(jsonReq("POST", { token, newPassword: "brand-new-pw-9" }));
    expect(res.status).toBe(200);
    const updated = userRepo.findByEmail(email)!;
    expect(await bcrypt.compare("brand-new-pw-9", updated.passwordHash)).toBe(true);
  });

  it("reset-password with newPassword shorter than 8 returns 400", async () => {
    const userId = process.env.AUTH_TEST_USER_ID!;
    const { token } = tokenRepo.createReset(userId);
    const res = await resetPasswordRoute(jsonReq("POST", { token, newPassword: "short" }));
    expect(res.status).toBe(400);
  });

  it("reset-password with a used token returns 400", async () => {
    const userId = process.env.AUTH_TEST_USER_ID!;
    const { token } = tokenRepo.createReset(userId);
    await resetPasswordRoute(jsonReq("POST", { token, newPassword: "valid-password-1" }));
    const second = await resetPasswordRoute(
      jsonReq("POST", { token, newPassword: "another-pw-2" }),
    );
    expect(second.status).toBe(400);
  });

  it("send-verification with no session returns 401", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await sendVerificationRoute(nextEmptyReq("POST"));
    expect(res.status).toBe(401);
  });

  it("send-verification with session sends one email", async () => {
    const res = await sendVerificationRoute(nextEmptyReq("POST"));
    expect(res.status).toBe(200);
    const emails = getCapturedEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].body).toContain("/api/auth/verify-email?token=");
  });

  it("verify-email redirects to /account?verified=1 and sets emailVerifiedAt", async () => {
    const userId = process.env.AUTH_TEST_USER_ID!;
    const { token } = tokenRepo.createVerification(userId);
    const res = await verifyEmailRoute(
      nextEmptyReq("GET", `http://test.local/api/auth/verify-email?token=${token}`),
    );
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("/account");
    expect(loc).toContain("verified=1");
    const user = userRepo.findById(userId);
    expect(user?.emailVerifiedAt).toBeTruthy();
  });

  it("verify-email with an invalid token redirects to /account?verified=error", async () => {
    const res = await verifyEmailRoute(
      nextEmptyReq("GET", "http://test.local/api/auth/verify-email?token=garbage"),
    );
    expect(res.status).toBe(307);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("verified=error");
  });

  it("signup pushes one verification email to the sink", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    clearCapturedEmails();
    const res = await signupRoute(
      jsonReq("POST", {
        email: "newby@example.com",
        password: "password123",
        name: "Newby",
      }),
    );
    expect(res.status).toBe(200);
    const emails = getCapturedEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("newby@example.com");
    expect(emails[0].subject).toBe("Verify your EnvDocOS Traffic account");
  });
});

describe("Auth route input validation", () => {
  it("signup rejects non-JSON body", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await signupRoute(textReq("POST", "not json"));
    expect(res.status).toBe(400);
  });
  it("signup rejects missing email", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await signupRoute(jsonReq("POST", { password: "password123", name: "X" }));
    expect(res.status).toBe(400);
  });
  it("signup rejects short password", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await signupRoute(
      jsonReq("POST", { email: "a@b.com", password: "short", name: "X" }),
    );
    expect(res.status).toBe(400);
  });
  it("signup rejects missing name", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await signupRoute(jsonReq("POST", { email: "a@b.com", password: "password123" }));
    expect(res.status).toBe(400);
  });

  it("change-password rejects non-JSON body", async () => {
    const res = await changePasswordRoute(textReq("POST", "garbage"));
    expect(res.status).toBe(400);
  });
  it("change-password rejects missing currentPassword", async () => {
    const res = await changePasswordRoute(jsonReq("POST", { newPassword: "newpassword1" }));
    expect(res.status).toBe(400);
  });
  it("change-password rejects missing newPassword", async () => {
    const res = await changePasswordRoute(jsonReq("POST", { currentPassword: "password123" }));
    expect(res.status).toBe(400);
  });
  it("change-password rejects short newPassword", async () => {
    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "password123", newPassword: "x" }),
    );
    expect(res.status).toBe(400);
  });
  it("change-password unauth → 401", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "password123", newPassword: "newpassword1" }),
    );
    expect(res.status).toBe(401);
  });

  it("forgot-password swallows missing email and returns 200", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await forgotPasswordRoute(nextJsonReq("POST", {}));
    expect(res.status).toBe(200);
  });
  it("forgot-password swallows non-JSON and returns 200", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    // Cast: forgotPasswordRoute expects NextRequest; helper returns Request shape.
    const res = await forgotPasswordRoute(nextJsonReq("POST", { email: "no-at-sign" }));
    expect(res.status).toBe(200);
  });

  it("reset-password rejects missing token", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await resetPasswordRoute(jsonReq("POST", { newPassword: "newpassword1" }));
    expect(res.status).toBe(400);
  });
  it("reset-password rejects non-JSON", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await resetPasswordRoute(textReq("POST", "x"));
    expect(res.status).toBe(400);
  });

  it("send-verification 401 unauth", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await sendVerificationRoute(nextEmptyReq("POST"));
    expect(res.status).toBe(401);
  });
});

describe("Email change", () => {
  it("change-email + confirm rotates the user's email", async () => {
    clearCapturedEmails();
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "rotated@example.com", currentPassword: "password123" }),
    );
    expect(res.status).toBe(200);
    const emails = getCapturedEmails();
    // Two emails: confirmation to the new address, notification to the old.
    expect(emails).toHaveLength(2);
    expect(emails[0].to).toBe("rotated@example.com");
    expect(emails[1].to).toBe("test@example.com");
    const link = emails[0].link;
    // Link points to the UI confirmation PAGE, not the API route — the page
    // is what fires the consuming POST after the user clicks Confirm.
    expect(link).toContain("/account/confirm-email-change?token=");
    expect(link).not.toContain("/api/auth/confirm-email-change");
    const tokenMatch = link.match(/token=([a-f0-9]+)/);
    expect(tokenMatch).not.toBeNull();
    const confirm = await confirmEmailChangeRoute(jsonReq("POST", { token: tokenMatch![1] }));
    expect(confirm.status).toBe(200);
    const body = (await confirm.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
    const updated = userRepo.findById(process.env.AUTH_TEST_USER_ID!);
    expect(updated?.email).toBe("rotated@example.com");
  });

  it("change-email also notifies the OLD address with a 'wasn't me' CTA, no new-email plaintext", async () => {
    clearCapturedEmails();
    const newEmail = "moving-to@example.com";
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail, currentPassword: "password123" }),
    );
    expect(res.status).toBe(200);
    const emails = getCapturedEmails();
    expect(emails).toHaveLength(2);

    const toNew = emails.find((e) => e.to === newEmail);
    const toOld = emails.find((e) => e.to === "test@example.com");
    expect(toNew).toBeDefined();
    expect(toOld).toBeDefined();

    // Old-address email must NOT contain the new email anywhere — neither the
    // body, the subject, nor the link. Leaking the destination address to a
    // compromised old account tells an attacker where the user is moving.
    expect(toOld!.body).not.toContain(newEmail);
    expect(toOld!.subject).not.toContain(newEmail);
    expect(toOld!.link).not.toContain(newEmail);

    // And it must NOT link to the confirm-email-change page (that's the new
    // address's responsibility). Link should drive the user toward securing
    // the account — i.e. /account or the password-reset flow.
    expect(toOld!.link).not.toContain("/account/confirm-email-change");
    expect(toOld!.link).toMatch(/\/account(\b|$|\?|#|\/)/);

    // Body should carry "wasn't me" / change-password language as the CTA.
    expect(toOld!.body.toLowerCase()).toMatch(/wasn'?t you|wasn'?t me|change your password/);
  });

  it("change-email succeeds even if the old-address notification send throws", async () => {
    clearCapturedEmails();
    const emailMod = await import("@/lib/email");
    const spy = vi
      .spyOn(emailMod, "sendEmailChangeNotification")
      .mockRejectedValue(new Error("simulated SMTP failure"));
    try {
      const res = await changeEmailRoute(
        jsonReq("POST", { newEmail: "soft-fail@example.com", currentPassword: "password123" }),
      );
      expect(res.status).toBe(200);
      const emails = getCapturedEmails();
      // Primary confirmation still landed.
      expect(emails.some((e) => e.to === "soft-fail@example.com")).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });

  it("peek GET returns the new email without consuming the token", async () => {
    clearCapturedEmails();
    await changeEmailRoute(
      jsonReq("POST", { newEmail: "peek@example.com", currentPassword: "password123" }),
    );
    const token = getCapturedEmails()[0]!.link.match(/token=([a-f0-9]+)/)![1];
    const peek1 = await peekEmailChangeRoute(
      nextEmptyReq("GET", `http://test.local/api/auth/confirm-email-change?token=${token}`),
    );
    expect(peek1.status).toBe(200);
    const body1 = (await peek1.json()) as { newEmail?: string };
    expect(body1.newEmail).toBe("peek@example.com");
    // Second peek must still succeed — proving GET did NOT consume.
    const peek2 = await peekEmailChangeRoute(
      nextEmptyReq("GET", `http://test.local/api/auth/confirm-email-change?token=${token}`),
    );
    expect(peek2.status).toBe(200);
    const body2 = (await peek2.json()) as { newEmail?: string };
    expect(body2.newEmail).toBe("peek@example.com");
    // And the user's email is still the original — no consumption side effect.
    const u = userRepo.findById(process.env.AUTH_TEST_USER_ID!);
    expect(u?.email).toBe("test@example.com");
  });

  it("peek GET returns 404 for garbage/missing/used/expired tokens", async () => {
    const garbage = await peekEmailChangeRoute(
      nextEmptyReq("GET", "http://test.local/api/auth/confirm-email-change?token=garbage"),
    );
    expect(garbage.status).toBe(404);
    const missing = await peekEmailChangeRoute(
      nextEmptyReq("GET", "http://test.local/api/auth/confirm-email-change"),
    );
    expect(missing.status).toBe(404);
    // Used token: confirm once, then peek must 404.
    clearCapturedEmails();
    await changeEmailRoute(
      jsonReq("POST", { newEmail: "used@example.com", currentPassword: "password123" }),
    );
    const token = getCapturedEmails()[0]!.link.match(/token=([a-f0-9]+)/)![1];
    const consumed = await confirmEmailChangeRoute(jsonReq("POST", { token }));
    expect(consumed.status).toBe(200);
    const peekUsed = await peekEmailChangeRoute(
      nextEmptyReq("GET", `http://test.local/api/auth/confirm-email-change?token=${token}`),
    );
    expect(peekUsed.status).toBe(404);
  });

  it("change-email rejects wrong current password", async () => {
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "x@y.com", currentPassword: "wrong" }),
    );
    expect(res.status).toBe(401);
  });

  it("change-email rejects invalid email format", async () => {
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "no-at-sign", currentPassword: "password123" }),
    );
    expect(res.status).toBe(400);
  });

  it("change-email rejects same-as-current email", async () => {
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "test@example.com", currentPassword: "password123" }),
    );
    expect(res.status).toBe(400);
  });

  it("change-email rejects already-taken email", async () => {
    seedUser("taken@example.com");
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "taken@example.com", currentPassword: "password123" }),
    );
    expect(res.status).toBe(409);
  });

  it("change-email runs bcrypt before the email-conflict check (no enumeration)", async () => {
    // If the route 409'd before checking the password, an attacker could probe
    // arbitrary emails with a junk password and tell which exist. Verify the
    // password check fires first by sending a wrong password + a taken email.
    seedUser("alreadymine@example.com");
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "alreadymine@example.com", currentPassword: "wrong" }),
    );
    expect(res.status).toBe(401);
  });

  it("change-email requires a session", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "x@y.com", currentPassword: "password123" }),
    );
    expect(res.status).toBe(401);
  });

  it("confirm-email-change POST with garbage token returns 400 invalid", async () => {
    const res = await confirmEmailChangeRoute(jsonReq("POST", { token: "garbage" }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("invalid");
  });

  it("confirm-email-change POST without token returns 400 missing", async () => {
    const res = await confirmEmailChangeRoute(jsonReq("POST", {}));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("missing");
  });
});

describe("Audit log", () => {
  it("records project.update + traffic.import + report.generate", async () => {
    const project = await makeProject();
    await patchProject(jsonReq("PATCH", { name: "Audited" }), { params: { id: project.id } });
    await uploadCsv(textReq("POST", SAMPLE_CSV), { params: { id: project.id } });
    await generateReport(emptyReq("POST"), { params: { id: project.id } });
    const res = await listAuditRoute(emptyReq("GET"), { params: { id: project.id } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ action: string }>;
    const actions = body.map((e) => e.action);
    expect(actions).toContain("project.update");
    expect(actions).toContain("traffic.import");
    expect(actions).toContain("report.generate");
  });

  it("records share.add and share.remove", async () => {
    const project = await makeProject();
    const shareeId = seedUser("audit-share@example.com");
    await addShare(jsonReq("POST", { email: "audit-share@example.com" }), {
      params: { id: project.id },
    });
    await removeShare(emptyReq("DELETE"), { params: { id: project.id, userId: shareeId } });
    const res = await listAuditRoute(emptyReq("GET"), { params: { id: project.id } });
    const body = (await res.json()) as Array<{ action: string }>;
    expect(body.map((e) => e.action)).toEqual(
      expect.arrayContaining(["share.add", "share.remove"]),
    );
  });

  it("returns 403 to a sharee", async () => {
    const project = await makeProject();
    const shareeId = seedUser("audit-sharee@example.com");
    await addShare(jsonReq("POST", { email: "audit-sharee@example.com" }), {
      params: { id: project.id },
    });
    process.env.AUTH_TEST_USER_ID = shareeId;
    const res = await listAuditRoute(emptyReq("GET"), { params: { id: project.id } });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the project doesn't exist", async () => {
    const res = await listAuditRoute(emptyReq("GET"), { params: { id: "nope" } });
    expect(res.status).toBe(404);
  });

  it("project.delete is recorded and survives the cascade", async () => {
    const project = await makeProject();
    const projectId = project.id;
    const ownerId = process.env.AUTH_TEST_USER_ID!;
    const del = await deleteProject(emptyReq("DELETE"), { params: { id: projectId } });
    expect(del.status).toBe(204);
    // Project is gone, but the audit row about its deletion survives because
    // audit_log.projectId has no FK reference. Re-create a fresh project so
    // we have something to compare; query the repo directly for verification.
    const { auditRepo } = await import("@/lib/db");
    const rows = auditRepo.listForProject(projectId);
    expect(rows.some((r) => r.action === "project.delete")).toBe(true);
    expect(ownerId).toBeTruthy();
  });

  it("paginates with default limit 50 and reports hasMore via cursor", async () => {
    const project = await makeProject();
    const { _dbInternal } = await import("@/lib/db");
    // Seed 60 audit rows with monotonically-decreasing createdAt so the cursor
    // can split them. (The real-world clock has ms resolution; a tight loop
    // can collide, so we set createdAt explicitly here.)
    const conn = _dbInternal();
    const insert = conn.prepare(
      "INSERT INTO audit_log (id, projectId, userId, action, details, createdAt) VALUES (?, ?, NULL, 'section.update', NULL, ?)",
    );
    for (let i = 0; i < 60; i++) {
      const iso = new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString();
      insert.run(`audit-${i}`, project.id, iso);
    }
    const res = await listAuditRoute(emptyReq("GET"), { params: { id: project.id } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string; createdAt: string }>;
    expect(body.length).toBe(50);
    // Cursor-fetch the next page using the oldest visible row's createdAt.
    const cursor = body[body.length - 1]!.createdAt;
    const next = await listAuditRoute(
      new Request(`http://x/?before=${encodeURIComponent(cursor)}&limit=50`),
      { params: { id: project.id } },
    );
    const nextBody = (await next.json()) as Array<{ id: string }>;
    // 60 seeded; first page = 50 newest, second page = remaining 10.
    expect(nextBody.length).toBe(10);
    // No id overlap between pages.
    const firstIds = new Set(body.map((r) => r.id));
    for (const r of nextBody) expect(firstIds.has(r.id)).toBe(false);
  });

  it("clamps limit to max 200 and ignores invalid limit values", async () => {
    const project = await makeProject();
    const { auditRepo } = await import("@/lib/db");
    for (let i = 0; i < 5; i++) {
      auditRepo.log({ projectId: project.id, userId: null, action: "section.update" });
    }
    // limit=99999 -> clamped, returns all rows
    const big = await listAuditRoute(new Request("http://x/?limit=99999"), {
      params: { id: project.id },
    });
    const bigBody = (await big.json()) as unknown[];
    expect(bigBody.length).toBeGreaterThan(0);
    // limit=garbage -> default (50)
    const garbage = await listAuditRoute(new Request("http://x/?limit=not-a-number"), {
      params: { id: project.id },
    });
    expect(garbage.status).toBe(200);
    const garbageBody = (await garbage.json()) as unknown[];
    expect(garbageBody.length).toBeLessThanOrEqual(50);
    // limit=0 / negative -> default
    const zero = await listAuditRoute(new Request("http://x/?limit=0"), {
      params: { id: project.id },
    });
    expect(zero.status).toBe(200);
    const neg = await listAuditRoute(new Request("http://x/?limit=-5"), {
      params: { id: project.id },
    });
    expect(neg.status).toBe(200);
  });

  it("respects an explicit small limit", async () => {
    const project = await makeProject();
    const { auditRepo } = await import("@/lib/db");
    for (let i = 0; i < 5; i++) {
      auditRepo.log({ projectId: project.id, userId: null, action: "section.update" });
    }
    const res = await listAuditRoute(new Request("http://x/?limit=2"), {
      params: { id: project.id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body.length).toBe(2);
  });

  it("confirm-email-change handles a UNIQUE-constraint race as conflict", async () => {
    // Issue a valid token, but seed the new email on another user before the
    // token is consumed. The fast-path `findByEmail` catches it; this test
    // exists so we notice if that fast path is removed (the catch becomes the
    // only line of defense).
    clearCapturedEmails();
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "raceme@example.com", currentPassword: "password123" }),
    );
    expect(res.status).toBe(200);
    const token = getCapturedEmails()[0]!.link.match(/token=([a-f0-9]+)/)![1];
    seedUser("raceme@example.com"); // race: someone else just took the email
    const confirm = await confirmEmailChangeRoute(jsonReq("POST", { token }));
    expect(confirm.status).toBe(409);
    const body = (await confirm.json()) as { error?: string };
    expect(body.error).toBe("conflict");
  });
});

describe("Rate limiting on password-bearing endpoints", () => {
  it("change-password 429s after 5 wrong attempts in the window", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await changePasswordRoute(
        jsonReq("POST", { currentPassword: "wrong", newPassword: "newpassword1" }),
      );
      expect(res.status).toBe(401);
    }
    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "wrong", newPassword: "newpassword1" }),
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toMatch(/^\d+$/);
  });

  it("change-password 429 doesn't reveal whether the password was correct", async () => {
    for (let i = 0; i < 5; i++) {
      await changePasswordRoute(
        jsonReq("POST", { currentPassword: "wrong", newPassword: "newpassword1" }),
      );
    }
    // 6th call with the *correct* password — must still be 429, not 200.
    // Otherwise an attacker mid-rate-limit could probe to identify the
    // correct password by watching the status code change.
    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "password123", newPassword: "newpassword1" }),
    );
    expect(res.status).toBe(429);
  });

  it("change-password rate limit is per-user", async () => {
    const otherUserId = seedUser("otheruser@example.com");
    for (let i = 0; i < 5; i++) {
      await changePasswordRoute(
        jsonReq("POST", { currentPassword: "wrong", newPassword: "newpassword1" }),
      );
    }
    process.env.AUTH_TEST_USER_ID = otherUserId;
    // Other user is unaffected.
    const res = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "wrong", newPassword: "newpassword1" }),
    );
    expect(res.status).toBe(401);
  });

  it("change-password successful password verification resets the counter", async () => {
    for (let i = 0; i < 4; i++) {
      await changePasswordRoute(
        jsonReq("POST", { currentPassword: "wrong", newPassword: "newpassword1" }),
      );
    }
    // Successful change clears the bucket; subsequent typos shouldn't carry over.
    const ok = await changePasswordRoute(
      jsonReq("POST", { currentPassword: "password123", newPassword: "newpassword1" }),
    );
    expect(ok.status).toBe(200);
    for (let i = 0; i < 5; i++) {
      const res = await changePasswordRoute(
        jsonReq("POST", { currentPassword: "wrong", newPassword: "newpassword2" }),
      );
      expect(res.status).toBe(401);
    }
  });

  it("change-email 429s after 5 wrong attempts", async () => {
    for (let i = 0; i < 5; i++) {
      await changeEmailRoute(jsonReq("POST", { newEmail: "x@y.com", currentPassword: "wrong" }));
    }
    const res = await changeEmailRoute(
      jsonReq("POST", { newEmail: "x@y.com", currentPassword: "wrong" }),
    );
    expect(res.status).toBe(429);
  });

  it("account-delete 429s after 5 wrong attempts", async () => {
    for (let i = 0; i < 5; i++) {
      await deleteAccountRoute(jsonReq("DELETE", { currentPassword: "wrong" }));
    }
    const res = await deleteAccountRoute(jsonReq("DELETE", { currentPassword: "wrong" }));
    expect(res.status).toBe(429);
  });
});

describe("Account deletion", () => {
  it("deletes the user and cascades projects/reports", async () => {
    const userId = process.env.AUTH_TEST_USER_ID!;
    await makeReport();
    const res = await deleteAccountRoute(jsonReq("DELETE", { currentPassword: "password123" }));
    expect(res.status).toBe(200);
    expect(userRepo.findById(userId)).toBeUndefined();
    process.env.AUTH_TEST_USER_ID = userId;
    const list = await listProjects();
    expect(await list.json()).toEqual([]);
  });

  it("rejects wrong password", async () => {
    const res = await deleteAccountRoute(jsonReq("DELETE", { currentPassword: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("requires currentPassword in body", async () => {
    const res = await deleteAccountRoute(jsonReq("DELETE", {}));
    expect(res.status).toBe(400);
  });

  it("requires a session", async () => {
    delete process.env.AUTH_TEST_USER_ID;
    const res = await deleteAccountRoute(jsonReq("DELETE", { currentPassword: "password123" }));
    expect(res.status).toBe(401);
  });
});

describe("Audit log GDPR scrub on user delete", () => {
  // Inline helper: read raw audit_log rows (including ones with no project access)
  // straight out of the DB so we can assert on details/userId post-cascade.
  async function rawAuditRows(): Promise<
    Array<{
      id: string;
      projectId: string;
      userId: string | null;
      action: string;
      details: string | null;
    }>
  > {
    const { _dbInternal } = await import("@/lib/db");
    return _dbInternal()
      .prepare("SELECT id, projectId, userId, action, details FROM audit_log")
      .all() as Array<{
      id: string;
      projectId: string;
      userId: string | null;
      action: string;
      details: string | null;
    }>;
  }

  it("scrubs details mentioning the deleted user (actor rows)", async () => {
    const ownerId = process.env.AUTH_TEST_USER_ID!;
    const project = await makeProject();
    const shareeId = seedUser("scrub-target@example.com");
    // owner adds a share -> audit row userId=ownerId, details.targetUserId=shareeId
    await addShare(jsonReq("POST", { email: "scrub-target@example.com" }), {
      params: { id: project.id },
    });

    // sanity: row exists pre-delete with raw ids
    const before = await rawAuditRows();
    const shareAddBefore = before.find((r) => r.action === "share.add")!;
    expect(shareAddBefore.userId).toBe(ownerId);
    expect(shareAddBefore.details).toContain(shareeId);

    const { auditRepo } = await import("@/lib/db");
    auditRepo.scrubUser(shareeId);

    const after = await rawAuditRows();
    const shareAddAfter = after.find((r) => r.action === "share.add")!;
    expect(shareAddAfter.details).not.toContain(shareeId);
    expect(shareAddAfter.details).toContain("[scrubbed]");
    // action + row preserved
    expect(shareAddAfter.action).toBe("share.add");
    void ownerId;
  });

  it("does not over-scrub rows belonging to other users", async () => {
    const project = await makeProject();
    const otherId = seedUser("other-untouched@example.com");
    const shareeId = seedUser("scrub-me@example.com");
    // add a share for the unrelated other user
    await addShare(jsonReq("POST", { email: "other-untouched@example.com" }), {
      params: { id: project.id },
    });

    const { auditRepo } = await import("@/lib/db");
    auditRepo.scrubUser(shareeId);

    const after = await rawAuditRows();
    const shareAdd = after.find((r) => r.action === "share.add")!;
    // unrelated row still mentions the un-deleted other user
    expect(shareAdd.details).toContain(otherId);
    expect(shareAdd.details).not.toContain("[scrubbed]");
  });

  it("scrubs rows where the deleted user was the share target (different actor)", async () => {
    const project = await makeProject();
    const shareeId = seedUser("target-only@example.com");
    await addShare(jsonReq("POST", { email: "target-only@example.com" }), {
      params: { id: project.id },
    });
    await removeShare(emptyReq("DELETE"), { params: { id: project.id, userId: shareeId } });

    const { auditRepo } = await import("@/lib/db");
    auditRepo.scrubUser(shareeId);

    const after = await rawAuditRows();
    const shareRows = after.filter((r) => r.action === "share.add" || r.action === "share.remove");
    expect(shareRows.length).toBeGreaterThanOrEqual(2);
    for (const r of shareRows) {
      expect(r.details ?? "").not.toContain(shareeId);
      expect(r.details ?? "").toContain("[scrubbed]");
    }
  });

  it("is idempotent — calling scrubUser twice does not double-scrub or fail", async () => {
    const project = await makeProject();
    const shareeId = seedUser("idem@example.com");
    await addShare(jsonReq("POST", { email: "idem@example.com" }), {
      params: { id: project.id },
    });

    const { auditRepo } = await import("@/lib/db");
    auditRepo.scrubUser(shareeId);
    const first = await rawAuditRows();
    auditRepo.scrubUser(shareeId);
    const second = await rawAuditRows();
    expect(second).toEqual(first);
  });

  it("DELETE /api/auth/account scrubs details before the FK cascade nulls userId", async () => {
    // owner shares a project to a sharee, then deletes its own account.
    // The cascade SET NULLs audit_log.userId for owner-actor rows; we want
    // any details still mentioning the owner (or, in a target-of-share row,
    // the owner-as-target) to be scrubbed.
    const ownerId = process.env.AUTH_TEST_USER_ID!;
    const project = await makeProject();
    // Make someone else share a project back to the owner so owner appears
    // as a targetUserId. Easiest path: switch session to a fresh user, have
    // them create a project and share to the owner.
    const otherId = seedUser("delegator@example.com");
    process.env.AUTH_TEST_USER_ID = otherId;
    const otherProject = await createProject(jsonReq("POST", PROJECT_BODY));
    const otherProjectId = (await otherProject.json()).id;
    await addShare(jsonReq("POST", { email: "test@example.com" }), {
      params: { id: otherProjectId },
    });
    // switch back to owner and delete account
    process.env.AUTH_TEST_USER_ID = ownerId;
    void project;
    const res = await deleteAccountRoute(jsonReq("DELETE", { currentPassword: "password123" }));
    expect(res.status).toBe(200);

    const { _dbInternal } = await import("@/lib/db");
    const rows = _dbInternal().prepare("SELECT details FROM audit_log").all() as Array<{
      details: string | null;
    }>;
    for (const r of rows) {
      expect(r.details ?? "").not.toContain(ownerId);
    }
  });

  it("preserves audit_log.createdAt across scrubUser", async () => {
    const project = await makeProject();
    const shareeId = seedUser("preserve-createdAt@example.com");
    await addShare(jsonReq("POST", { email: "preserve-createdAt@example.com" }), {
      params: { id: project.id },
    });
    const { _dbInternal, auditRepo } = await import("@/lib/db");
    const before = _dbInternal()
      .prepare("SELECT id, createdAt FROM audit_log WHERE action = 'share.add'")
      .get() as { id: string; createdAt: string };
    auditRepo.scrubUser(shareeId);
    const after = _dbInternal()
      .prepare("SELECT id, createdAt FROM audit_log WHERE id = ?")
      .get(before.id) as { id: string; createdAt: string };
    expect(after.createdAt).toBe(before.createdAt);
  });

  it("ignores non-JSON details (no over-broad substring scrub)", async () => {
    // Synthesize a non-JSON details row that happens to contain the userId as
    // a substring of unrelated text. scrubUser must NOT touch it: details is
    // contractually JSON in the codebase, and the LIKE-substring fallback is
    // a footgun if a UUID ever appears inside unrelated free text.
    const project = await makeProject();
    const shareeId = seedUser("non-json@example.com");
    const { _dbInternal, auditRepo } = await import("@/lib/db");
    const conn = _dbInternal();
    const rowId = "non-json-row";
    conn
      .prepare(
        "INSERT INTO audit_log (id, projectId, userId, action, details, createdAt) VALUES (?, ?, NULL, ?, ?, ?)",
      )
      .run(
        rowId,
        project.id,
        "synthetic.note",
        `free text mentioning ${shareeId} inline`,
        new Date().toISOString(),
      );
    auditRepo.scrubUser(shareeId);
    const after = conn.prepare("SELECT details FROM audit_log WHERE id = ?").get(rowId) as {
      details: string;
    };
    expect(after.details).toBe(`free text mentioning ${shareeId} inline`);
  });
});
