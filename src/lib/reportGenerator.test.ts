import { describe, it, expect } from "vitest";
import { calculateMetrics, generateReportSections } from "./reportGenerator";
import type { Project, TrafficCountRow } from "./types";

const project: Project = {
  id: "p1",
  userId: null,
  name: "West Loop Mixed Use",
  location: "123 Main St, Chicago, IL",
  jurisdiction: "Chicago",
  projectType: "Mixed-use development",
  developmentSummary: "120 units and 15,000 sq ft of retail",
  createdAt: "2026-04-30T00:00:00Z",
};

const row = (over: Partial<TrafficCountRow>): TrafficCountRow => ({
  id: "r" + Math.random(),
  projectId: "p1",
  intersection: "A",
  period: "AM",
  inbound: 0,
  outbound: 0,
  total: 0,
  ...over,
});

describe("calculateMetrics", () => {
  it("returns zeros for empty input", () => {
    const m = calculateMetrics([]);
    expect(m.intersections).toEqual([]);
    expect(m.totalAmVolume).toBe(0);
    expect(m.totalPmVolume).toBe(0);
    expect(m.highestAmIntersection).toBeUndefined();
    expect(m.highestPmIntersection).toBeUndefined();
  });

  it("sums totals per period and identifies peaks", () => {
    const rows = [
      row({ intersection: "A", period: "AM", total: 100 }),
      row({ intersection: "A", period: "AM", total: 50 }),
      row({ intersection: "B", period: "AM", total: 200 }),
      row({ intersection: "A", period: "PM", total: 300 }),
      row({ intersection: "B", period: "PM", total: 100 }),
    ];
    const m = calculateMetrics(rows);
    expect(m.intersections).toEqual(["A", "B"]);
    expect(m.totalAmVolume).toBe(350);
    expect(m.totalPmVolume).toBe(400);
    expect(m.highestAmIntersection).toBe("B");
    expect(m.highestAmTotal).toBe(200);
    expect(m.highestPmIntersection).toBe("A");
    expect(m.highestPmTotal).toBe(300);
  });
});

describe("generateReportSections", () => {
  it("returns 8 sections in order with status draft", () => {
    const sections = generateReportSections(project, []);
    expect(sections).toHaveLength(8);
    expect(sections.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(sections.every((s) => s.status === "draft")).toBe(true);
  });

  it("interpolates project metadata into the executive summary", () => {
    const sections = generateReportSections(project, []);
    const exec = sections.find((s) => s.id === "executive-summary")!;
    expect(exec.content).toContain("Mixed-use development");
    expect(exec.content).toContain("123 Main St, Chicago, IL");
  });

  it("interpolates peak intersections into existing-conditions", () => {
    const rows = [
      row({ intersection: "Peak St", period: "AM", total: 999 }),
      row({ intersection: "Peak St", period: "PM", total: 1234 }),
    ];
    const sections = generateReportSections(project, rows);
    const ec = sections.find((s) => s.id === "existing-conditions")!;
    expect(ec.content).toContain("Peak St");
    expect(ec.content).toContain("999");
    expect(ec.content).toContain("1234");
  });

  it("study-area says 'no intersections imported' when empty", () => {
    const sections = generateReportSections(project, []);
    const sa = sections.find((s) => s.id === "study-area")!;
    expect(sa.content).toContain("no intersections imported");
  });

  it("uses canned trip-generation and conclusion text when manualInputs is empty", () => {
    const sections = generateReportSections(project, []);
    const tg = sections.find((s) => s.id === "trip-generation")!;
    const c = sections.find((s) => s.id === "conclusion")!;
    expect(tg.content).toContain("prepared based on the proposed land use");
    expect(c.content).toContain("preliminary evaluation of traffic conditions");
  });

  it("overrides trip-generation content when tripGenAssumptions is set", () => {
    const p2: Project = {
      ...project,
      manualInputs: { tripGenAssumptions: "Custom ITE 220 trip gen text." },
    };
    const sections = generateReportSections(p2, []);
    const tg = sections.find((s) => s.id === "trip-generation")!;
    expect(tg.content).toBe("Custom ITE 220 trip gen text.");
    expect(tg.machineBaseline).toBe("Custom ITE 220 trip gen text.");
  });

  it("overrides conclusion content when engineerConclusions is set", () => {
    const p2: Project = {
      ...project,
      manualInputs: { engineerConclusions: "Engineer signed-off conclusion." },
    };
    const sections = generateReportSections(p2, []);
    const c = sections.find((s) => s.id === "conclusion")!;
    expect(c.content).toBe("Engineer signed-off conclusion.");
    expect(c.machineBaseline).toBe("Engineer signed-off conclusion.");
  });

  it("appends growthRate sentence to impact-analysis when set", () => {
    const p2: Project = {
      ...project,
      manualInputs: { growthRate: "1.5% per year" },
    };
    const sections = generateReportSections(p2, []);
    const ia = sections.find((s) => s.id === "impact-analysis")!;
    expect(ia.content).toContain("Intersections with higher existing volumes");
    expect(ia.content).toContain("1.5% per year");
  });

  it("impact-analysis machineBaseline equals content when growthRate is set", () => {
    const p2: Project = {
      ...project,
      manualInputs: { growthRate: "2% per year" },
    };
    const sections = generateReportSections(p2, []);
    const ia = sections.find((s) => s.id === "impact-analysis")!;
    expect(ia.machineBaseline).toBe(ia.content);
  });

  it("impact-analysis content matches canned text exactly when growthRate is unset", () => {
    const sections = generateReportSections(project, []);
    const ia = sections.find((s) => s.id === "impact-analysis")!;
    expect(ia.content).toBe(
      `Based on the available count data and preliminary project information, the proposed project may affect operations at selected study intersections. Intersections with higher existing volumes or larger projected increases should be reviewed further by the project traffic engineer.`,
    );
  });

  it("appends mitigationNotes paragraph to mitigation when set", () => {
    const p2: Project = {
      ...project,
      manualInputs: { mitigationNotes: "Add eastbound left turn lane at 1st & Main." },
    };
    const sections = generateReportSections(p2, []);
    const mit = sections.find((s) => s.id === "mitigation")!;
    expect(mit.content).toContain("signal timing review");
    expect(mit.content).toContain("Engineer notes: Add eastbound left turn lane at 1st & Main.");
  });

  it("mitigation machineBaseline equals content when mitigationNotes is set", () => {
    const p2: Project = {
      ...project,
      manualInputs: { mitigationNotes: "Coordinate signals on Main St." },
    };
    const sections = generateReportSections(p2, []);
    const mit = sections.find((s) => s.id === "mitigation")!;
    expect(mit.machineBaseline).toBe(mit.content);
  });

  it("mitigation content matches canned text exactly when mitigationNotes is unset", () => {
    const sections = generateReportSections(project, []);
    const mit = sections.find((s) => s.id === "mitigation")!;
    expect(mit.content).toBe(
      `Potential mitigation measures may include signal timing review, access management adjustments, turn lane evaluation, pedestrian improvements, or additional operational analysis. Final mitigation recommendations should be confirmed by the responsible traffic engineer.`,
    );
  });
});
