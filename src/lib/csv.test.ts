import { describe, it, expect } from "vitest";
import { parseTrafficCsv, parseTrafficCsvDetailed } from "./csv";

const HEADER = "intersection,period,approach,inbound,outbound,total";

describe("parseTrafficCsv", () => {
  it("parses a happy-path CSV", () => {
    const csv = [
      HEADER,
      "Main St & 1st Ave,AM,Northbound,120,90,210",
      "Main St & 1st Ave,PM,Northbound,160,110,270",
      "Main St & 2nd Ave,AM,Eastbound,200,150,350",
    ].join("\n");
    const r = parseTrafficCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({
      intersection: "Main St & 1st Ave",
      period: "AM",
      approach: "Northbound",
      inbound: 120,
      outbound: 90,
      total: 210,
    });
  });

  it("rejects when a required column is missing", () => {
    const csv = "intersection,period,inbound,outbound\nMain,AM,1,2";
    const r = parseTrafficCsv(csv);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/Missing required columns/i);
    expect(r.error).toMatch(/total/);
  });

  it("rejects an invalid period and names the row", () => {
    const csv = `${HEADER}\nMain,RUSH,N,1,2,3`;
    const r = parseTrafficCsv(csv);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/Row 2/);
    expect(r.error).toMatch(/RUSH/);
  });

  it("rejects non-numeric inbound/outbound/total", () => {
    const csv = `${HEADER}\nMain,AM,N,abc,2,3`;
    const r = parseTrafficCsv(csv);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/Row 2/);
    expect(r.error).toMatch(/numbers/);
  });

  it("rejects empty intersection", () => {
    const csv = `${HEADER}\n,AM,N,1,2,3`;
    const r = parseTrafficCsv(csv);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/Row 2/);
    expect(r.error).toMatch(/intersection/);
  });

  it("trims header whitespace", () => {
    const csv = ` intersection , period , approach , inbound , outbound , total \nMain,AM,N,1,2,3`;
    const r = parseTrafficCsv(csv);
    expect(r.ok).toBe(true);
  });

  it("normalizes lowercase periods", () => {
    const csv = `${HEADER}\nMain,am,N,1,2,3`;
    const r = parseTrafficCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0].period).toBe("AM");
  });

  it("treats blank approach as undefined", () => {
    const csv = `${HEADER}\nMain,AM,,1,2,3`;
    const r = parseTrafficCsv(csv);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0].approach).toBeUndefined();
  });
});

describe("parseTrafficCsvDetailed", () => {
  it("returns fatal when a required column is missing", () => {
    const csv = "intersection,period,inbound,outbound\nMain,AM,1,2";
    const r = parseTrafficCsvDetailed(csv);
    expect(r.fatal).toBeTruthy();
    expect(r.fatal).toMatch(/Missing required columns/i);
    expect(r.validRows).toHaveLength(0);
    expect(r.invalidRows).toHaveLength(0);
  });

  it("partitions a 4-row CSV into two valid + two invalid rows", () => {
    const csv = [
      HEADER,
      "Main St & 1st,AM,N,1,2,3", // valid (row 2)
      "Main St & 1st,RUSH,N,1,2,3", // invalid period (row 3)
      "Main St & 1st,PM,N,4,5,9", // valid (row 4)
      ",AM,N,1,2,3", // empty intersection (row 5)
    ].join("\n");
    const r = parseTrafficCsvDetailed(csv);
    expect(r.fatal).toBeUndefined();
    expect(r.validRows).toHaveLength(2);
    expect(r.invalidRows).toHaveLength(2);
    expect(r.invalidRows[0].row).toBe(3);
    expect(r.invalidRows[1].row).toBe(5);
    expect(r.totalRows).toBe(4);
  });

  it("collects multiple issues for a single row", () => {
    const csv = `${HEADER}\nMain,RUSH,N,1,2,abc`;
    const r = parseTrafficCsvDetailed(csv);
    expect(r.invalidRows).toHaveLength(1);
    const issues = r.invalidRows[0].issues;
    expect(issues.length).toBeGreaterThanOrEqual(2);
    expect(issues.some((i) => i.column === "period")).toBe(true);
    expect(issues.some((i) => i.column === "total")).toBe(true);
  });
});
