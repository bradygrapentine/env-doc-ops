import { describe, it, expect, beforeEach } from "vitest";
import { projectRepo, trafficRepo } from "./db";
import { resetDb } from "../../test/db";

beforeEach(() => {
  resetDb();
});

const baseInput = {
  userId: null,
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

describe("trafficRepo row helpers", () => {
  const sampleRow = {
    intersection: "Main & 1st",
    period: "AM" as const,
    approach: "N",
    inbound: 10,
    outbound: 20,
    total: 30,
  };

  it("addRow round-trips through getRow", () => {
    const project = projectRepo.create(baseInput);
    const added = trafficRepo.addRow(project.id, sampleRow);
    expect(added.id).toBeTruthy();
    expect(added.projectId).toBe(project.id);
    const got = trafficRepo.getRow(project.id, added.id);
    expect(got).toMatchObject(sampleRow);
  });

  it("updateRow only changes supplied fields; others unchanged", () => {
    const project = projectRepo.create(baseInput);
    const added = trafficRepo.addRow(project.id, sampleRow);
    const updated = trafficRepo.updateRow(project.id, added.id, { inbound: 99 });
    expect(updated).toBeDefined();
    expect(updated!.inbound).toBe(99);
    expect(updated!.outbound).toBe(sampleRow.outbound);
    expect(updated!.total).toBe(sampleRow.total);
    expect(updated!.intersection).toBe(sampleRow.intersection);
    expect(updated!.period).toBe(sampleRow.period);
    expect(updated!.approach).toBe(sampleRow.approach);
  });

  it("getRow returns undefined for a row id from a different project", () => {
    const projA = projectRepo.create(baseInput);
    const projB = projectRepo.create({ ...baseInput, name: "B" });
    const added = trafficRepo.addRow(projA.id, sampleRow);
    expect(trafficRepo.getRow(projB.id, added.id)).toBeUndefined();
    expect(trafficRepo.updateRow(projB.id, added.id, { inbound: 1 })).toBeUndefined();
  });

  it("deleteRow returns false for a row not in the project", () => {
    const projA = projectRepo.create(baseInput);
    const projB = projectRepo.create({ ...baseInput, name: "B" });
    const added = trafficRepo.addRow(projA.id, sampleRow);
    expect(trafficRepo.deleteRow(projB.id, added.id)).toBe(false);
    expect(trafficRepo.deleteRow(projA.id, "nope")).toBe(false);
    expect(trafficRepo.deleteRow(projA.id, added.id)).toBe(true);
    expect(trafficRepo.getRow(projA.id, added.id)).toBeUndefined();
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
