import Papa from "papaparse";
import type { Period, TrafficCountRow } from "./types";

const REQUIRED = ["intersection", "period", "inbound", "outbound", "total"] as const;

export type ParsedTrafficRow = Omit<TrafficCountRow, "id" | "projectId">;

export type CsvParseResult = { ok: true; rows: ParsedTrafficRow[] } | { ok: false; error: string };

export type RowIssue = { row: number; column?: string; message: string };

export type InvalidRow = {
  row: number;
  raw: Record<string, string>;
  issues: RowIssue[];
};

export type DetailedParseResult = {
  headers: string[];
  totalRows: number;
  validRows: ParsedTrafficRow[];
  invalidRows: InvalidRow[];
  fatal?: string;
};

const PERIODS: Period[] = ["AM", "PM", "MIDDAY", "OTHER"];

export function parseTrafficCsvDetailed(text: string): DetailedParseResult {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields ?? [];

  if (result.errors.length) {
    return {
      headers,
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      fatal: `CSV parse error: ${result.errors[0].message}`,
    };
  }

  const missing = REQUIRED.filter((c) => !headers.includes(c));
  if (missing.length) {
    return {
      headers,
      totalRows: 0,
      validRows: [],
      invalidRows: [],
      fatal: `Missing required columns: ${missing.join(", ")}`,
    };
  }

  const validRows: ParsedTrafficRow[] = [];
  const invalidRows: InvalidRow[] = [];

  for (let i = 0; i < result.data.length; i++) {
    const r = result.data[i];
    const rowNum = i + 2;
    const issues: RowIssue[] = [];

    const periodRaw = (r.period ?? "").trim();
    const period = periodRaw.toUpperCase();
    if (!PERIODS.includes(period as Period)) {
      issues.push({
        row: rowNum,
        column: "period",
        message: `Invalid period "${r.period ?? ""}". Expected one of ${PERIODS.join(", ")}.`,
      });
    }

    const inbound = Number(r.inbound);
    const outbound = Number(r.outbound);
    const total = Number(r.total);

    if (!Number.isFinite(inbound)) {
      issues.push({
        row: rowNum,
        column: "inbound",
        message: `inbound must be a number (got "${r.inbound ?? ""}").`,
      });
    }
    if (!Number.isFinite(outbound)) {
      issues.push({
        row: rowNum,
        column: "outbound",
        message: `outbound must be a number (got "${r.outbound ?? ""}").`,
      });
    }
    if (!Number.isFinite(total)) {
      issues.push({
        row: rowNum,
        column: "total",
        message: `total must be a number (got "${r.total ?? ""}").`,
      });
    }

    const intersection = (r.intersection ?? "").trim();
    if (!intersection) {
      issues.push({
        row: rowNum,
        column: "intersection",
        message: "intersection is required.",
      });
    }

    if (issues.length === 0) {
      validRows.push({
        intersection,
        period: period as Period,
        approach: r.approach?.trim() || undefined,
        inbound,
        outbound,
        total,
      });
    } else {
      invalidRows.push({ row: rowNum, raw: r, issues });
    }
  }

  return {
    headers,
    totalRows: result.data.length,
    validRows,
    invalidRows,
  };
}

export function parseTrafficCsv(text: string): CsvParseResult {
  const detailed = parseTrafficCsvDetailed(text);
  if (detailed.fatal) return { ok: false, error: detailed.fatal };
  if (detailed.invalidRows.length) {
    const first = detailed.invalidRows[0];
    const firstIssue = first.issues[0];
    // Preserve legacy error shapes used by existing tests/UI.
    if (firstIssue.column === "period") {
      const raw = first.raw.period ?? "";
      return {
        ok: false,
        error: `Row ${first.row}: invalid period "${raw}". Expected one of ${PERIODS.join(", ")}.`,
      };
    }
    if (
      firstIssue.column === "inbound" ||
      firstIssue.column === "outbound" ||
      firstIssue.column === "total"
    ) {
      return {
        ok: false,
        error: `Row ${first.row}: inbound/outbound/total must be numbers.`,
      };
    }
    if (firstIssue.column === "intersection") {
      return { ok: false, error: `Row ${first.row}: intersection is required.` };
    }
    return { ok: false, error: `Row ${first.row}: ${firstIssue.message}` };
  }
  return { ok: true, rows: detailed.validRows };
}
