import { describe, it, expect, beforeEach } from "vitest";
import { projectRepo } from "./db";
import { resetDb } from "../../test/db";

beforeEach(() => {
  resetDb();
});

const baseInput = {
  name: "Original",
  location: "City",
  jurisdiction: "Town",
  projectType: "Mixed-use",
  developmentSummary: "Summary",
  clientName: "Acme",
  preparedBy: "Engineer",
};

describe("projectRepo.update", () => {
  it("returns undefined for a missing project", () => {
    expect(projectRepo.update("nope", { name: "X" })).toBeUndefined();
  });

  it("only updates the fields in the patch (does not null other fields)", () => {
    const created = projectRepo.create(baseInput);
    const updated = projectRepo.update(created.id, { name: "Renamed" });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe("Renamed");
    expect(updated!.location).toBe(baseInput.location);
    expect(updated!.jurisdiction).toBe(baseInput.jurisdiction);
    expect(updated!.clientName).toBe(baseInput.clientName);
    expect(updated!.preparedBy).toBe(baseInput.preparedBy);
    expect(updated!.projectType).toBe(baseInput.projectType);
    expect(updated!.developmentSummary).toBe(baseInput.developmentSummary);
    expect(updated!.id).toBe(created.id);
    expect(updated!.createdAt).toBe(created.createdAt);
  });

  it("updates multiple fields at once", () => {
    const created = projectRepo.create(baseInput);
    const updated = projectRepo.update(created.id, {
      name: "N2",
      location: "L2",
      preparedBy: "PB2",
    });
    expect(updated!.name).toBe("N2");
    expect(updated!.location).toBe("L2");
    expect(updated!.preparedBy).toBe("PB2");
    expect(updated!.jurisdiction).toBe(baseInput.jurisdiction);
  });
});

describe("projectRepo manualInputs", () => {
  it("create round-trips manualInputs through get", () => {
    const created = projectRepo.create({
      ...baseInput,
      manualInputs: {
        growthRate: "1.5%",
        tripGenAssumptions: "ITE 220",
      },
    });
    const got = projectRepo.get(created.id);
    expect(got!.manualInputs).toEqual({
      growthRate: "1.5%",
      tripGenAssumptions: "ITE 220",
    });
  });

  it("update sets manualInputs JSON", () => {
    const created = projectRepo.create(baseInput);
    expect(created.manualInputs).toBeUndefined();
    const updated = projectRepo.update(created.id, {
      manualInputs: {
        engineerConclusions: "Looks fine.",
      },
    });
    expect(updated!.manualInputs).toEqual({ engineerConclusions: "Looks fine." });
    const got = projectRepo.get(created.id);
    expect(got!.manualInputs).toEqual({ engineerConclusions: "Looks fine." });
  });

  it("update with manualInputs: undefined clears the column", () => {
    const created = projectRepo.create({
      ...baseInput,
      manualInputs: { tripGenAssumptions: "x" },
    });
    expect(created.manualInputs).toEqual({ tripGenAssumptions: "x" });
    const cleared = projectRepo.update(created.id, { manualInputs: undefined });
    expect(cleared!.manualInputs).toBeUndefined();
    const got = projectRepo.get(created.id);
    expect(got!.manualInputs).toBeUndefined();
  });
});

describe("projectRepo.delete", () => {
  it("returns false for an unknown id", () => {
    expect(projectRepo.delete("nope")).toBe(false);
  });

  it("returns true and removes the project on success", () => {
    const created = projectRepo.create(baseInput);
    expect(projectRepo.delete(created.id)).toBe(true);
    expect(projectRepo.get(created.id)).toBeUndefined();
  });
});
