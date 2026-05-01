import type { ReportSection } from "./types";

export type RegeneratePlan = {
  merged: ReportSection[];
  refreshed: string[];
  preserved: string[];
};

function normalize(s: string): string {
  return s.replace(/\r\n/g, "\n").trim();
}

export function planRegenerate(
  existing: ReportSection[] | undefined,
  fresh: ReportSection[],
): RegeneratePlan {
  if (!existing || existing.length === 0) {
    return {
      merged: fresh.map((s) => ({ ...s, machineBaseline: s.content })),
      refreshed: fresh.map((s) => s.id),
      preserved: [],
    };
  }

  const byId = new Map(existing.map((s) => [s.id, s]));
  const refreshed: string[] = [];
  const preserved: string[] = [];

  const merged = fresh.map((f) => {
    const cur = byId.get(f.id);
    if (!cur) {
      refreshed.push(f.id);
      return { ...f, machineBaseline: f.content };
    }
    const userEdited = normalize(cur.content) !== normalize(cur.machineBaseline);
    const reviewed = cur.status !== "draft";
    if (userEdited || reviewed) {
      preserved.push(f.id);
      return { ...cur, title: f.title, order: f.order, machineBaseline: f.content };
    }
    refreshed.push(f.id);
    return { ...f, machineBaseline: f.content };
  });

  return { merged, refreshed, preserved };
}
