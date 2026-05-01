import { describe, it, expect } from "vitest";
import { parseTrafficCsv } from "./csv";

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
