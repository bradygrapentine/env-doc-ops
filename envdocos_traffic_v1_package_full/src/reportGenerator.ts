import { Project, TrafficCountRow, TrafficMetrics, ReportSection } from "./types";

export function calculateMetrics(rows: TrafficCountRow[]): TrafficMetrics {
  const intersections = Array.from(new Set(rows.map(r => r.intersection)));

  const totalByPeriodAndIntersection = (period: string) => {
    const totals = new Map<string, number>();
    for (const row of rows.filter(r => r.period === period)) {
      totals.set(row.intersection, (totals.get(row.intersection) ?? 0) + row.total);
    }
    return totals;
  };

  const amTotals = totalByPeriodAndIntersection("AM");
  const pmTotals = totalByPeriodAndIntersection("PM");

  const maxEntry = (map: Map<string, number>) => {
    let best: [string, number] | undefined;
    for (const entry of map.entries()) {
      if (!best || entry[1] > best[1]) best = entry;
    }
    return best;
  };

  const highestAm = maxEntry(amTotals);
  const highestPm = maxEntry(pmTotals);

  return {
    intersections,
    highestAmIntersection: highestAm?.[0],
    highestAmTotal: highestAm?.[1],
    highestPmIntersection: highestPm?.[0],
    highestPmTotal: highestPm?.[1],
    totalAmVolume: Array.from(amTotals.values()).reduce((a, b) => a + b, 0),
    totalPmVolume: Array.from(pmTotals.values()).reduce((a, b) => a + b, 0),
  };
}

export function generateReportSections(project: Project, rows: TrafficCountRow[]): ReportSection[] {
  const metrics = calculateMetrics(rows);
  const intersectionList = metrics.intersections.join(", ");

  return [
    {
      id: "executive-summary",
      title: "Executive Summary",
      order: 1,
      status: "draft",
      content: `This report summarizes the anticipated transportation impacts associated with the proposed ${project.projectType} project located at ${project.location}. The analysis considers existing traffic conditions, proposed development characteristics, available traffic count data, and potential transportation impacts at nearby study intersections.`
    },
    {
      id: "project-description",
      title: "Project Description",
      order: 2,
      status: "draft",
      content: `The proposed project, ${project.name}, is located at ${project.location} within ${project.jurisdiction}. The development consists of ${project.developmentSummary}. The purpose of this report is to evaluate anticipated traffic impacts associated with the proposed development and identify whether mitigation or additional study may be required.`
    },
    {
      id: "study-area",
      title: "Study Area",
      order: 3,
      status: "draft",
      content: `The study area includes intersections and roadway segments expected to be influenced by site-generated traffic. Based on the available traffic count data, the following intersections were reviewed: ${intersectionList}.`
    },
    {
      id: "existing-conditions",
      title: "Existing Conditions",
      order: 4,
      status: "draft",
      content: `Traffic count data were reviewed for the study intersections during the AM and PM peak periods. The highest observed AM total volume was recorded at ${metrics.highestAmIntersection ?? "N/A"} with ${metrics.highestAmTotal ?? 0} total vehicles. The highest observed PM total volume was recorded at ${metrics.highestPmIntersection ?? "N/A"} with ${metrics.highestPmTotal ?? 0} total vehicles.`
    },
    {
      id: "trip-generation",
      title: "Trip Generation",
      order: 5,
      status: "draft",
      content: `Trip generation estimates should be prepared based on the proposed land use characteristics and applicable jurisdictional or ITE-based assumptions. For V1, this section should be reviewed and completed by the responsible traffic engineer.`
    },
    {
      id: "impact-analysis",
      title: "Impact Analysis",
      order: 6,
      status: "draft",
      content: `Based on the available count data and preliminary project information, the proposed project may affect operations at selected study intersections. Intersections with higher existing volumes or larger projected increases should be reviewed further by the project traffic engineer.`
    },
    {
      id: "mitigation",
      title: "Mitigation / Recommendations",
      order: 7,
      status: "draft",
      content: `Potential mitigation measures may include signal timing review, access management adjustments, turn lane evaluation, pedestrian improvements, or additional operational analysis. Final mitigation recommendations should be confirmed by the responsible traffic engineer.`
    },
    {
      id: "conclusion",
      title: "Conclusion",
      order: 8,
      status: "draft",
      content: `This report provides a preliminary evaluation of traffic conditions associated with the proposed project. The findings are intended to support engineering review and should be supplemented by professional judgment, jurisdictional requirements, and any required traffic modeling.`
    }
  ];
}
