import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type { Project, TrafficCountRow, Report, ReportSection, Period, SectionStatus } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    clientName TEXT,
    projectType TEXT NOT NULL,
    developmentSummary TEXT NOT NULL,
    preparedBy TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS traffic_counts (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    intersection TEXT NOT NULL,
    period TEXT NOT NULL,
    approach TEXT,
    inbound INTEGER NOT NULL,
    outbound INTEGER NOT NULL,
    total INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_traffic_project ON traffic_counts(projectId);

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS report_sections (
    id TEXT NOT NULL,
    reportId TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    machineBaseline TEXT,
    PRIMARY KEY (reportId, id)
  );
`;

function migrate(conn: Database.Database) {
  try {
    conn.exec(`ALTER TABLE report_sections ADD COLUMN machineBaseline TEXT`);
  } catch (e) {
    const msg = (e as Error).message;
    if (!/duplicate column name/i.test(msg)) throw e;
  }
  conn.exec(`UPDATE report_sections SET machineBaseline = content WHERE machineBaseline IS NULL`);
}

let _db: Database.Database | null = null;
function dbPath(): string {
  return process.env.ENVDOCOS_DB_PATH ?? path.join(DATA_DIR, "envdocos.db");
}
function db(): Database.Database {
  if (_db) return _db;
  const p = dbPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const conn = new Database(p);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA_SQL);
  migrate(conn);
  _db = conn;
  return conn;
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

const uid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));
const now = () => new Date().toISOString();

export const projectRepo = {
  list(): Project[] {
    return db().prepare("SELECT * FROM projects ORDER BY createdAt DESC").all() as Project[];
  },
  get(id: string): Project | undefined {
    return db().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
  },
  create(input: Omit<Project, "id" | "createdAt">): Project {
    const project: Project = { ...input, id: uid(), createdAt: now() };
    db().prepare(`
      INSERT INTO projects (id, name, location, jurisdiction, clientName, projectType, developmentSummary, preparedBy, createdAt)
      VALUES (@id, @name, @location, @jurisdiction, @clientName, @projectType, @developmentSummary, @preparedBy, @createdAt)
    `).run({
      ...project,
      clientName: project.clientName ?? null,
      preparedBy: project.preparedBy ?? null,
    });
    return project;
  },
};

export const trafficRepo = {
  listByProject(projectId: string): TrafficCountRow[] {
    return db().prepare("SELECT * FROM traffic_counts WHERE projectId = ?").all(projectId) as TrafficCountRow[];
  },
  replaceForProject(projectId: string, rows: Omit<TrafficCountRow, "id" | "projectId">[]): TrafficCountRow[] {
    const conn = db();
    const insert = conn.prepare(`
      INSERT INTO traffic_counts (id, projectId, intersection, period, approach, inbound, outbound, total)
      VALUES (@id, @projectId, @intersection, @period, @approach, @inbound, @outbound, @total)
    `);
    const del = conn.prepare("DELETE FROM traffic_counts WHERE projectId = ?");
    const tx = conn.transaction((rs: Omit<TrafficCountRow, "id" | "projectId">[]) => {
      del.run(projectId);
      const out: TrafficCountRow[] = [];
      for (const r of rs) {
        const full: TrafficCountRow = { ...r, id: uid(), projectId };
        insert.run({ ...full, approach: full.approach ?? null });
        out.push(full);
      }
      return out;
    });
    return tx(rows);
  },
};

export const reportRepo = {
  get(id: string): Report | undefined {
    const conn = db();
    const row = conn.prepare("SELECT * FROM reports WHERE id = ?").get(id) as
      | { id: string; projectId: string; createdAt: string; updatedAt: string }
      | undefined;
    if (!row) return undefined;
    const sections = conn
      .prepare(`SELECT id, title, "order", content, status, machineBaseline FROM report_sections WHERE reportId = ? ORDER BY "order"`)
      .all(id) as ReportSection[];
    return { ...row, sections };
  },
  getByProject(projectId: string): Report | undefined {
    const conn = db();
    const row = conn.prepare("SELECT id FROM reports WHERE projectId = ?").get(projectId) as { id: string } | undefined;
    if (!row) return undefined;
    return reportRepo.get(row.id);
  },
  upsertForProject(projectId: string, sections: ReportSection[]): Report {
    const conn = db();
    const existing = conn.prepare("SELECT id FROM reports WHERE projectId = ?").get(projectId) as { id: string } | undefined;
    const reportId = existing?.id ?? uid();
    const ts = now();
    const tx = conn.transaction(() => {
      if (existing) {
        conn.prepare("UPDATE reports SET updatedAt = ? WHERE id = ?").run(ts, reportId);
        conn.prepare("DELETE FROM report_sections WHERE reportId = ?").run(reportId);
      } else {
        conn.prepare("INSERT INTO reports (id, projectId, createdAt, updatedAt) VALUES (?, ?, ?, ?)").run(reportId, projectId, ts, ts);
      }
      const insertSection = conn.prepare(`
        INSERT INTO report_sections (id, reportId, title, "order", content, status, machineBaseline)
        VALUES (@id, @reportId, @title, @order, @content, @status, @machineBaseline)
      `);
      for (const s of sections) insertSection.run({ ...s, reportId });
    });
    tx();
    return reportRepo.get(reportId)!;
  },
  updateSection(reportId: string, sectionId: string, patch: Partial<Pick<ReportSection, "content" | "status" | "title">>): Report | undefined {
    const conn = db();
    const fields: string[] = [];
    const values: (string | SectionStatus)[] = [];
    if (patch.content !== undefined) { fields.push("content = ?"); values.push(patch.content); }
    if (patch.status !== undefined) { fields.push("status = ?"); values.push(patch.status); }
    if (patch.title !== undefined) { fields.push("title = ?"); values.push(patch.title); }
    if (fields.length === 0) return reportRepo.get(reportId);
    conn.prepare(`UPDATE report_sections SET ${fields.join(", ")} WHERE reportId = ? AND id = ?`).run(...values, reportId, sectionId);
    conn.prepare("UPDATE reports SET updatedAt = ? WHERE id = ?").run(now(), reportId);
    return reportRepo.get(reportId);
  },
};

export type { Period };
