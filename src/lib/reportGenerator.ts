import type { Project, TrafficCountRow, TrafficMetrics, ReportSection } from "./types";

export function calculateMetrics(rows: TrafficCountRow[]): TrafficMetrics {
  const intersections = Array.from(new Set(rows.map((r) => r.intersection)));

  const totalsByPeriod = (period: string) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (r.period !== period) continue;
      m.set(r.intersection, (m.get(r.intersection) ?? 0) + r.total);
    }
    return m;
  };

  const am = totalsByPeriod("AM");
  const pm = totalsByPeriod("PM");

  const peak = (m: Map<string, number>) => {
    let best: [string, number] | undefined;
    for (const e of m.entries()) if (!best || e[1] > best[1]) best = e;
    return best;
  };

  const ha = peak(am);
  const hp = peak(pm);
  const sum = (m: Map<string, number>) => Array.from(m.values()).reduce((a, b) => a + b, 0);

  return {
    intersections,
    highestAmIntersection: ha?.[0],
    highestAmTotal: ha?.[1],
    highestPmIntersection: hp?.[0],
    highestPmTotal: hp?.[1],
    totalAmVolume: sum(am),
    totalPmVolume: sum(pm),
  };
}

export function generateReportSections(project: Project, rows: TrafficCountRow[]): ReportSection[] {
  const m = calculateMetrics(rows);
  const list = m.intersections.length ? m.intersections.join(", ") : "no intersections imported";

  return [
    {
      id: "executive-summary",
      title: "Executive Summary",
      order: 1,
      status: "draft",
      content: `This report summarizes the anticipated transportation impacts associated with the proposed ${project.projectType} project located at ${project.location}. The analysis considers existing traffic conditions, proposed development characteristics, available traffic count data, and potential transportation impacts at nearby study intersections.`,
    },
    {
      id: "project-description",
      title: "Project Description",
      order: 2,
      status: "draft",
      content: `The proposed project, ${project.name}, is located at ${project.location} within ${project.jurisdiction}. The development consists of ${project.developmentSummary}. The purpose of this report is to evaluate anticipated traffic impacts associated with the proposed development and identify whether mitigation or additional study may be required.`,
    },
    {
      id: "study-area",
      title: "Study Area",
      order: 3,
      status: "draft",
      content: `The study area includes intersections and roadway segments expected to be influenced by site-generated traffic. Based on the available traffic count data, the following intersections were reviewed: ${list}.`,
    },
    {
      id: "existing-conditions",
      title: "Existing Conditions",
      order: 4,
      status: "draft",
      content: `Traffic count data were reviewed for the study intersections during the AM and PM peak periods. The highest observed AM total volume was recorded at ${m.highestAmIntersection ?? "N/A"} with ${m.highestAmTotal ?? 0} total vehicles. The highest observed PM total volume was recorded at ${m.highestPmIntersection ?? "N/A"} with ${m.highestPmTotal ?? 0} total vehicles.`,
    },
    {
      id: "trip-generation",
      title: "Trip Generation",
      order: 5,
      status: "draft",
      content: `Trip generation estimates should be prepared based on the proposed land use characteristics and applicable jurisdictional or ITE-based assumptions. For V1, this section should be reviewed and completed by the responsible traffic engineer.`,
    },
    {
      id: "impact-analysis",
      title: "Impact Analysis",
      order: 6,
      status: "draft",
      content: `Based on the available count data and preliminary project information, the proposed project may affect operations at selected study intersections. Intersections with higher existing volumes or larger projected increases should be reviewed further by the project traffic engineer.`,
    },
    {
      id: "mitigation",
      title: "Mitigation / Recommendations",
      order: 7,
      status: "draft",
      content: `Potential mitigation measures may include signal timing review, access management adjustments, turn lane evaluation, pedestrian improvements, or additional operational analysis. Final mitigation recommendations should be confirmed by the responsible traffic engineer.`,
    },
    {
      id: "conclusion",
      title: "Conclusion",
      order: 8,
      status: "draft",
      content: `This report provides a preliminary evaluation of traffic conditions associated with the proposed project. The findings are intended to support engineering review and should be supplemented by professional judgment, jurisdictional requirements, and any required traffic modeling.`,
    },
  ];
}
