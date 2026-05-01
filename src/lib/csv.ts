import Papa from "papaparse";
import type { Period, TrafficCountRow } from "./types";

const REQUIRED = ["intersection", "period", "inbound", "outbound", "total"] as const;

export type ParsedTrafficRow = Omit<TrafficCountRow, "id" | "projectId">;

export type CsvParseResult =
  | { ok: true; rows: ParsedTrafficRow[] }
  | { ok: false; error: string };

const PERIODS: Period[] = ["AM", "PM", "MIDDAY", "OTHER"];

export function parseTrafficCsv(text: string): CsvParseResult {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (result.errors.length) {
    return { ok: false, error: `CSV parse error: ${result.errors[0].message}` };
  }

  const headers = result.meta.fields ?? [];
  const missing = REQUIRED.filter((c) => !headers.includes(c));
  if (missing.length) return { ok: false, error: `Missing required columns: ${missing.join(", ")}` };

  const rows: ParsedTrafficRow[] = [];
  for (let i = 0; i < result.data.length; i++) {
    const r = result.data[i];
    const period = (r.period ?? "").trim().toUpperCase();
    if (!PERIODS.includes(period as Period)) {
      return { ok: false, error: `Row ${i + 2}: invalid period "${r.period}". Expected one of ${PERIODS.join(", ")}.` };
    }
    const inbound = Number(r.inbound);
    const outbound = Number(r.outbound);
    const total = Number(r.total);
    if (!Number.isFinite(inbound) || !Number.isFinite(outbound) || !Number.isFinite(total)) {
      return { ok: false, error: `Row ${i + 2}: inbound/outbound/total must be numbers.` };
    }
    const intersection = (r.intersection ?? "").trim();
    if (!intersection) return { ok: false, error: `Row ${i + 2}: intersection is required.` };

    rows.push({
      intersection,
      period: period as Period,
      approach: r.approach?.trim() || undefined,
      inbound,
      outbound,
      total,
    });
  }

  return { ok: true, rows };
}
