import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import { buildReportDocx } from "./docx";
import type { Project, Report, TrafficCountRow } from "./types";

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
    { id: "executive-summary", title: "Executive Summary", order: 1, content: "Body of exec summary.", status: "draft", machineBaseline: "Body of exec summary." },
    { id: "existing-conditions", title: "Existing Conditions", order: 4, content: "Existing conditions body.", status: "draft", machineBaseline: "Existing conditions body." },
    { id: "conclusion", title: "Conclusion", order: 8, content: "Body of conclusion.", status: "draft", machineBaseline: "Body of conclusion." },
  ],
};

const rows: TrafficCountRow[] = [
  { id: "1", projectId: "p1", intersection: "Beta St at 1st", period: "AM", approach: "NB", inbound: 10, outbound: 20, total: 30 },
  { id: "2", projectId: "p1", intersection: "Alpha Ave at 2nd", period: "PM", approach: "EB", inbound: 100, outbound: 200, total: 300 },
];

async function getXml(project: Project, report: Report, rows: TrafficCountRow[] = []) {
  const buf = await buildReportDocx(project, report, rows);
  const zip = await JSZip.loadAsync(buf);
  return await zip.file("word/document.xml")!.async("string");
}

describe("buildReportDocx", () => {
  it("returns a non-empty buffer that is a valid ZIP", async () => {
    const buf = await buildReportDocx(project, report, rows);
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("includes the cover page with project name and prepared-by", async () => {
    const xml = await getXml(project, report, rows);
    expect(xml).toContain("Traffic Impact Report");
    expect(xml).toContain("Test Project");
    expect(xml).toContain("QA");
  });

  it("includes each section title in document.xml", async () => {
    const xml = await getXml(project, report, rows);
    expect(xml).toContain("Executive Summary");
    expect(xml).toContain("Existing Conditions");
    expect(xml).toContain("Conclusion");
  });

  it("emits two tables when rows are present", async () => {
    const xml = await getXml(project, report, rows);
    const tableCount = (xml.match(/<w:tbl>/g) ?? []).length;
    expect(tableCount).toBe(2);
  });

  it("includes every row's intersection name in the document", async () => {
    const xml = await getXml(project, report, rows);
    for (const r of rows) expect(xml).toContain(r.intersection);
  });

  it("emits no tables when no rows are present", async () => {
    const xml = await getXml(project, report, []);
    const tableCount = (xml.match(/<w:tbl>/g) ?? []).length;
    expect(tableCount).toBe(0);
  });

  it("sorts the counts table by intersection then period", async () => {
    const xml = await getXml(project, report, rows);
    const countsHeader = xml.indexOf("Counts by intersection");
    expect(countsHeader).toBeGreaterThan(0);
    const tail = xml.slice(countsHeader);
    const alphaIdx = tail.indexOf("Alpha Ave at 2nd");
    const betaIdx = tail.indexOf("Beta St at 1st");
    expect(alphaIdx).toBeGreaterThan(0);
    expect(alphaIdx).toBeLessThan(betaIdx);
  });
});
