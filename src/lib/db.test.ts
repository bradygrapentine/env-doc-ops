import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { projectRepo, trafficRepo, shareRepo, userRepo } from "./db";
import { resetDb } from "../../test/db";

beforeEach(async () => {
  await resetDb();
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
  it("returns undefined for a missing project", async () => {
    expect(await projectRepo.update("nope", { name: "X" })).toBeUndefined();
  });

  it("only updates the fields in the patch (does not null other fields)", async () => {
    const created = await projectRepo.create(baseInput);
    const updated = await projectRepo.update(created.id, { name: "Renamed" });
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

  it("updates multiple fields at once", async () => {
    const created = await projectRepo.create(baseInput);
    const updated = await projectRepo.update(created.id, {
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
  it("create round-trips manualInputs through get", async () => {
    const created = await projectRepo.create({
      ...baseInput,
      manualInputs: {
        growthRate: "1.5%",
        tripGenAssumptions: "ITE 220",
      },
    });
    const got = await projectRepo.get(created.id);
    expect(got!.manualInputs).toEqual({
      growthRate: "1.5%",
      tripGenAssumptions: "ITE 220",
    });
  });

  it("update sets manualInputs JSON", async () => {
    const created = await projectRepo.create(baseInput);
    expect(created.manualInputs).toBeUndefined();
    const updated = await projectRepo.update(created.id, {
      manualInputs: {
        engineerConclusions: "Looks fine.",
      },
    });
    expect(updated!.manualInputs).toEqual({ engineerConclusions: "Looks fine." });
    const got = await projectRepo.get(created.id);
    expect(got!.manualInputs).toEqual({ engineerConclusions: "Looks fine." });
  });

  it("update with manualInputs: undefined clears the column", async () => {
    const created = await projectRepo.create({
      ...baseInput,
      manualInputs: { tripGenAssumptions: "x" },
    });
    expect(created.manualInputs).toEqual({ tripGenAssumptions: "x" });
    const cleared = await projectRepo.update(created.id, { manualInputs: undefined });
    expect(cleared!.manualInputs).toBeUndefined();
    const got = await projectRepo.get(created.id);
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

  it("addRow round-trips through getRow", async () => {
    const project = await projectRepo.create(baseInput);
    const added = await trafficRepo.addRow(project.id, sampleRow);
    expect(added.id).toBeTruthy();
    expect(added.projectId).toBe(project.id);
    const got = await trafficRepo.getRow(project.id, added.id);
    expect(got).toMatchObject(sampleRow);
  });

  it("updateRow only changes supplied fields; others unchanged", async () => {
    const project = await projectRepo.create(baseInput);
    const added = await trafficRepo.addRow(project.id, sampleRow);
    const updated = await trafficRepo.updateRow(project.id, added.id, { inbound: 99 });
    expect(updated).toBeDefined();
    expect(updated!.inbound).toBe(99);
    expect(updated!.outbound).toBe(sampleRow.outbound);
    expect(updated!.total).toBe(sampleRow.total);
    expect(updated!.intersection).toBe(sampleRow.intersection);
    expect(updated!.period).toBe(sampleRow.period);
    expect(updated!.approach).toBe(sampleRow.approach);
  });

  it("getRow returns undefined for a row id from a different project", async () => {
    const projA = await projectRepo.create(baseInput);
    const projB = await projectRepo.create({ ...baseInput, name: "B" });
    const added = await trafficRepo.addRow(projA.id, sampleRow);
    expect(await trafficRepo.getRow(projB.id, added.id)).toBeUndefined();
    expect(await trafficRepo.updateRow(projB.id, added.id, { inbound: 1 })).toBeUndefined();
  });

  it("deleteRow returns false for a row not in the project", async () => {
    const projA = await projectRepo.create(baseInput);
    const projB = await projectRepo.create({ ...baseInput, name: "B" });
    const added = await trafficRepo.addRow(projA.id, sampleRow);
    expect(await trafficRepo.deleteRow(projB.id, added.id)).toBe(false);
    expect(await trafficRepo.deleteRow(projA.id, "nope")).toBe(false);
    expect(await trafficRepo.deleteRow(projA.id, added.id)).toBe(true);
    expect(await trafficRepo.getRow(projA.id, added.id)).toBeUndefined();
  });
});

describe("shareRepo", () => {
  async function mkUser(email: string) {
    return await userRepo.create({
      email,
      name: email.split("@")[0],
      passwordHash: bcrypt.hashSync("password123", 4),
    });
  }

  it("add round-trips via listForProject", async () => {
    const owner = await mkUser("owner@a.test");
    const sharee = await mkUser("sharee@a.test");
    const project = await projectRepo.create({ ...baseInput, userId: owner.id });
    expect(await shareRepo.add(project.id, sharee.id, "reader")).toBe(true);
    const list = await shareRepo.listForProject(project.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      userId: sharee.id,
      email: "sharee@a.test",
      role: "reader",
    });
  });

  it("add is idempotent on duplicate", async () => {
    const owner = await mkUser("owner@b.test");
    const sharee = await mkUser("sharee@b.test");
    const project = await projectRepo.create({ ...baseInput, userId: owner.id });
    expect(await shareRepo.add(project.id, sharee.id, "reader")).toBe(true);
    expect(await shareRepo.add(project.id, sharee.id, "reader")).toBe(false);
    expect(await shareRepo.listForProject(project.id)).toHaveLength(1);
  });

  it("cascades on project deletion", async () => {
    const owner = await mkUser("owner@c.test");
    const sharee = await mkUser("sharee@c.test");
    const sharee2 = await mkUser("sharee2@c.test");
    const projectA = await projectRepo.create({ ...baseInput, userId: owner.id });
    const projectB = await projectRepo.create({ ...baseInput, name: "B", userId: owner.id });
    await shareRepo.add(projectA.id, sharee.id, "reader");
    await shareRepo.add(projectB.id, sharee2.id, "reader");
    await projectRepo.delete(projectA.id);
    expect(await shareRepo.listForProject(projectA.id)).toHaveLength(0);
    expect(await shareRepo.listForProject(projectB.id)).toHaveLength(1);
  });

  it("accessRole returns owner / reader / null", async () => {
    const owner = await mkUser("owner@d.test");
    const sharee = await mkUser("sharee@d.test");
    const stranger = await mkUser("stranger@d.test");
    const project = await projectRepo.create({ ...baseInput, userId: owner.id });
    await shareRepo.add(project.id, sharee.id, "reader");
    expect(await shareRepo.accessRole(project.id, owner.id)).toBe("owner");
    expect(await shareRepo.accessRole(project.id, sharee.id)).toBe("reader");
    expect(await shareRepo.accessRole(project.id, stranger.id)).toBe(null);
    expect(await shareRepo.accessRole("nope", owner.id)).toBe(null);
  });

  it("user-deletion cascades shares", async () => {
    const owner = await mkUser("owner@e.test");
    const sharee = await mkUser("sharee@e.test");
    const project = await projectRepo.create({ ...baseInput, userId: owner.id });
    await shareRepo.add(project.id, sharee.id, "reader");
    expect(await shareRepo.listForProject(project.id)).toHaveLength(1);
    const { _dbInternal } = await import("./db");
    await _dbInternal()`DELETE FROM users WHERE id = ${sharee.id}`;
    expect(await shareRepo.listForProject(project.id)).toHaveLength(0);
  });
});

describe("projectRepo.listAccessible", () => {
  async function mkUser(email: string) {
    return await userRepo.create({
      email,
      name: email.split("@")[0],
      passwordHash: bcrypt.hashSync("password123", 4),
    });
  }

  it("returns owned + shared with role attached", async () => {
    const a = await mkUser("a@list.test");
    const b = await mkUser("b@list.test");
    const owned = await projectRepo.create({ ...baseInput, userId: a.id, name: "Owned" });
    const others = await projectRepo.create({ ...baseInput, userId: b.id, name: "Others" });
    await shareRepo.add(others.id, a.id, "reader");
    const list = await projectRepo.listAccessible(a.id);
    expect(list).toHaveLength(2);
    const ownedRow = list.find((p) => p.id === owned.id);
    const sharedRow = list.find((p) => p.id === others.id);
    expect(ownedRow?.role).toBe("owner");
    expect(sharedRow?.role).toBe("reader");
    // owned precedes shared
    expect(list[0].role).toBe("owner");
  });
});

describe("projectRepo.delete", () => {
  it("returns false for an unknown id", async () => {
    expect(await projectRepo.delete("nope")).toBe(false);
  });

  it("returns true and removes the project on success", async () => {
    const created = await projectRepo.create(baseInput);
    expect(await projectRepo.delete(created.id)).toBe(true);
    expect(await projectRepo.get(created.id)).toBeUndefined();
  });
});
