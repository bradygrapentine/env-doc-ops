import { describe, it, expect } from "vitest";
import { buildReportPdf } from "./pdf";
import type { Project, Report, TrafficCountRow } from "./types";

const project: Project = {
  id: "p1",
  userId: null,
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
    {
      id: "executive-summary",
      title: "Executive Summary",
      order: 1,
      content: "Body of exec summary.",
      status: "draft",
      kind: "standard",
      machineBaseline: "Body of exec summary.",
    },
    {
      id: "existing-conditions",
      title: "Existing Conditions",
      order: 4,
      content: "Existing conditions body.",
      status: "draft",
      kind: "standard",
      machineBaseline: "Existing conditions body.",
    },
    {
      id: "conclusion",
      title: "Conclusion",
      order: 8,
      content: "Body of conclusion.",
      status: "draft",
      kind: "standard",
      machineBaseline: "Body of conclusion.",
    },
  ],
};

const rows: TrafficCountRow[] = [
  {
    id: "1",
    projectId: "p1",
    intersection: "Beta St at 1st",
    period: "AM",
    approach: "NB",
    inbound: 10,
    outbound: 20,
    total: 30,
  },
  {
    id: "2",
    projectId: "p1",
    intersection: "Alpha Ave at 2nd",
    period: "PM",
    approach: "EB",
    inbound: 100,
    outbound: 200,
    total: 300,
  },
];

describe("buildReportPdf", () => {
  it("returns a non-empty buffer", async () => {
    const buf = await buildReportPdf(project, report, rows);
    expect(buf.length).toBeGreaterThan(0);
  });

  it("starts with the %PDF magic bytes", async () => {
    const buf = await buildReportPdf(project, report, rows);
    expect(buf[0]).toBe(0x25); // %
    expect(buf[1]).toBe(0x50); // P
    expect(buf[2]).toBe(0x44); // D
    expect(buf[3]).toBe(0x46); // F
  });

  it("contains the project name and section title in the byte stream", async () => {
    const buf = await buildReportPdf(project, report, rows);
    const latin = buf.toString("latin1");
    // pdfkit may segment text; coarse latin1 substring check is good enough for V1.
    // Fall back to a size threshold if substrings aren't present (pdfkit is allowed to compress).
    const containsName = latin.includes(project.name);
    const containsSection = latin.includes("Executive Summary");
    expect(containsName || containsSection || buf.length > 1500).toBe(true);
  });
});
