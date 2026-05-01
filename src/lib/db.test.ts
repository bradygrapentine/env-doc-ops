import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { projectRepo, trafficRepo, shareRepo, userRepo } from "./db";
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

describe("shareRepo", () => {
  function mkUser(email: string) {
    return userRepo.create({
      email,
      name: email.split("@")[0],
      passwordHash: bcrypt.hashSync("password123", 4),
    });
  }

  it("add round-trips via listForProject", () => {
    const owner = mkUser("owner@a.test");
    const sharee = mkUser("sharee@a.test");
    const project = projectRepo.create({ ...baseInput, userId: owner.id });
    expect(shareRepo.add(project.id, sharee.id, "reader")).toBe(true);
    const list = shareRepo.listForProject(project.id);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      userId: sharee.id,
      email: "sharee@a.test",
      role: "reader",
    });
  });

  it("add is idempotent on duplicate", () => {
    const owner = mkUser("owner@b.test");
    const sharee = mkUser("sharee@b.test");
    const project = projectRepo.create({ ...baseInput, userId: owner.id });
    expect(shareRepo.add(project.id, sharee.id, "reader")).toBe(true);
    expect(shareRepo.add(project.id, sharee.id, "reader")).toBe(false);
    expect(shareRepo.listForProject(project.id)).toHaveLength(1);
  });

  it("cascades on project deletion", () => {
    const owner = mkUser("owner@c.test");
    const sharee = mkUser("sharee@c.test");
    const sharee2 = mkUser("sharee2@c.test");
    const projectA = projectRepo.create({ ...baseInput, userId: owner.id });
    const projectB = projectRepo.create({ ...baseInput, name: "B", userId: owner.id });
    shareRepo.add(projectA.id, sharee.id, "reader");
    shareRepo.add(projectB.id, sharee2.id, "reader");
    projectRepo.delete(projectA.id);
    expect(shareRepo.listForProject(projectA.id)).toHaveLength(0);
    expect(shareRepo.listForProject(projectB.id)).toHaveLength(1);
  });

  it("accessRole returns owner / reader / null", () => {
    const owner = mkUser("owner@d.test");
    const sharee = mkUser("sharee@d.test");
    const stranger = mkUser("stranger@d.test");
    const project = projectRepo.create({ ...baseInput, userId: owner.id });
    shareRepo.add(project.id, sharee.id, "reader");
    expect(shareRepo.accessRole(project.id, owner.id)).toBe("owner");
    expect(shareRepo.accessRole(project.id, sharee.id)).toBe("reader");
    expect(shareRepo.accessRole(project.id, stranger.id)).toBe(null);
    expect(shareRepo.accessRole("nope", owner.id)).toBe(null);
  });

  it("user-deletion cascades shares", async () => {
    const owner = mkUser("owner@e.test");
    const sharee = mkUser("sharee@e.test");
    const project = projectRepo.create({ ...baseInput, userId: owner.id });
    shareRepo.add(project.id, sharee.id, "reader");
    expect(shareRepo.listForProject(project.id)).toHaveLength(1);
    const { closeDb } = await import("./db");
    closeDb();
    const Database = (await import("better-sqlite3")).default;
    const conn = new Database(process.env.ENVDOCOS_DB_PATH!);
    conn.pragma("foreign_keys = ON");
    conn.prepare("DELETE FROM users WHERE id = ?").run(sharee.id);
    conn.close();
    expect(shareRepo.listForProject(project.id)).toHaveLength(0);
  });
});

describe("projectRepo.listAccessible", () => {
  function mkUser(email: string) {
    return userRepo.create({
      email,
      name: email.split("@")[0],
      passwordHash: bcrypt.hashSync("password123", 4),
    });
  }

  it("returns owned + shared with role attached", () => {
    const a = mkUser("a@list.test");
    const b = mkUser("b@list.test");
    const owned = projectRepo.create({ ...baseInput, userId: a.id, name: "Owned" });
    const others = projectRepo.create({ ...baseInput, userId: b.id, name: "Others" });
    shareRepo.add(others.id, a.id, "reader");
    const list = projectRepo.listAccessible(a.id);
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
  it("returns false for an unknown id", () => {
    expect(projectRepo.delete("nope")).toBe(false);
  });

  it("returns true and removes the project on success", () => {
    const created = projectRepo.create(baseInput);
    expect(projectRepo.delete(created.id)).toBe(true);
    expect(projectRepo.get(created.id)).toBeUndefined();
  });
});
