import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { resetDb } from "./db";
import { jsonReq, textReq, emptyReq } from "./routes";
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
import { POST as changePasswordRoute } from "@/app/api/auth/change-password/route";
import { GET as listShares, POST as addShare } from "@/app/api/projects/[id]/shares/route";
import { DELETE as removeShare } from "@/app/api/projects/[id]/shares/[userId]/route";

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
