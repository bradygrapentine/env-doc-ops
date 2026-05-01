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
import { POST as previewCsv } from "@/app/api/projects/[id]/traffic-data/preview/route";
import { POST as generateReport } from "@/app/api/projects/[id]/generate-report/route";
import { POST as previewReport } from "@/app/api/projects/[id]/generate-report/preview/route";
import { GET as getReport } from "@/app/api/reports/[id]/route";
import { PATCH as patchSection } from "@/app/api/reports/[id]/sections/[sectionId]/route";
import { POST as regenerateSection } from "@/app/api/reports/[id]/sections/[sectionId]/regenerate/route";
import { POST as exportDocx } from "@/app/api/reports/[id]/export-docx/route";
import { POST as exportPdf } from "@/app/api/reports/[id]/export-pdf/route";
import { POST as signupRoute } from "@/app/api/auth/signup/route";

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
