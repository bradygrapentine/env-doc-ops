import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildReportDocx } from "./docx";
import type { Project, Report } from "./types";

const project: Project = {
  id: "p1",
  name: "Test Project",
  location: "Anywhere",
  jurisdiction: "Test City",
  projectType: "Mixed-use",
  developmentSummary: "Test summary",
  preparedBy: "QA",
  createdAt: "2026-04-30T00:00:00Z",
};

const report: Report = {
  id: "r1",
  projectId: "p1",
  createdAt: "2026-04-30T00:00:00Z",
  updatedAt: "2026-04-30T00:00:00Z",
  sections: [
    { id: "executive-summary", title: "Executive Summary", order: 1, content: "Body of exec summary.", status: "draft" },
    { id: "conclusion", title: "Conclusion", order: 8, content: "Body of conclusion.", status: "draft" },
  ],
};

describe("buildReportDocx", () => {
  it("returns a non-empty buffer that is a valid ZIP", async () => {
    const buf = await buildReportDocx(project, report);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("includes each section title in document.xml", async () => {
    const buf = await buildReportDocx(project, report);
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file("word/document.xml")!.async("string");
    expect(xml).toContain("Executive Summary");
    expect(xml).toContain("Conclusion");
    expect(xml).toContain("Test Project");
  });
});
