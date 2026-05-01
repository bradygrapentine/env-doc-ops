import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resetDb } from "./db";
import { jsonReq, textReq, emptyReq } from "./routes";

import { POST as createProject, GET as listProjects } from "@/app/api/projects/route";
import { GET as getProject } from "@/app/api/projects/[id]/route";
import { POST as uploadCsv } from "@/app/api/projects/[id]/traffic-data/route";
import { POST as generateReport } from "@/app/api/projects/[id]/generate-report/route";
import { POST as previewReport } from "@/app/api/projects/[id]/generate-report/preview/route";
import { GET as getReport } from "@/app/api/reports/[id]/route";
import { PATCH as patchSection } from "@/app/api/reports/[id]/sections/[sectionId]/route";
import { POST as exportDocx } from "@/app/api/reports/[id]/export-docx/route";

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

beforeEach(() => {
  resetDb();
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
