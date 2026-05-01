import { describe, it, expect } from "vitest";
import { planRegenerate } from "./reportRegenerate";
import type { ReportSection, SectionStatus } from "./types";

const fresh = (id: string, content: string): ReportSection => ({
  id,
  title: id,
  order: 1,
  status: "draft",
  content,
  machineBaseline: content,
});

const existing = (id: string, content: string, baseline: string, status: SectionStatus = "draft"): ReportSection => ({
  id,
  title: id,
  order: 1,
  status,
  content,
  machineBaseline: baseline,
});

describe("planRegenerate", () => {
  it("returns all fresh sections as refreshed when no existing report", () => {
    const result = planRegenerate(undefined, [fresh("a", "A1"), fresh("b", "B1")]);
    expect(result.refreshed).toEqual(["a", "b"]);
    expect(result.preserved).toEqual([]);
    expect(result.merged.every((s) => s.machineBaseline === s.content)).toBe(true);
  });

  it("refreshes a draft section that was not edited", () => {
    const result = planRegenerate(
      [existing("a", "old", "old", "draft")],
      [fresh("a", "new")],
    );
    expect(result.refreshed).toEqual(["a"]);
    expect(result.preserved).toEqual([]);
    expect(result.merged[0].content).toBe("new");
    expect(result.merged[0].machineBaseline).toBe("new");
  });

  it("preserves a draft section that was edited", () => {
    const result = planRegenerate(
      [existing("a", "edited", "old", "draft")],
      [fresh("a", "new")],
    );
    expect(result.preserved).toEqual(["a"]);
    expect(result.refreshed).toEqual([]);
    expect(result.merged[0].content).toBe("edited");
    expect(result.merged[0].machineBaseline).toBe("new");
  });

  it("preserves a reviewed section even if unedited", () => {
    const result = planRegenerate(
      [existing("a", "old", "old", "reviewed")],
      [fresh("a", "new")],
    );
    expect(result.preserved).toEqual(["a"]);
    expect(result.merged[0].content).toBe("old");
    expect(result.merged[0].status).toBe("reviewed");
    expect(result.merged[0].machineBaseline).toBe("new");
  });

  it("preserves a final + edited section", () => {
    const result = planRegenerate(
      [existing("a", "edited", "old", "final")],
      [fresh("a", "new")],
    );
    expect(result.preserved).toEqual(["a"]);
    expect(result.merged[0].status).toBe("final");
    expect(result.merged[0].content).toBe("edited");
  });

  it("ignores trailing whitespace differences when detecting edits", () => {
    const result = planRegenerate(
      [existing("a", "same  \n", "same", "draft")],
      [fresh("a", "new")],
    );
    expect(result.refreshed).toEqual(["a"]);
  });

  it("a brand-new fresh section (no prior id) is refreshed", () => {
    const result = planRegenerate([existing("a", "old", "old")], [fresh("a", "new"), fresh("b", "B")]);
    expect(result.refreshed).toContain("b");
  });

  it("updates title and order from fresh even when preserving content", () => {
    const result = planRegenerate(
      [existing("a", "edited", "old", "draft")],
      [{ ...fresh("a", "new"), title: "New Title", order: 5 }],
    );
    expect(result.merged[0].title).toBe("New Title");
    expect(result.merged[0].order).toBe(5);
    expect(result.merged[0].content).toBe("edited");
  });
});
