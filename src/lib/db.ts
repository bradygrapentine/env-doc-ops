import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import type {
  Project,
  ManualInputs,
  TrafficCountRow,
  Report,
  ReportSection,
  Period,
  SectionStatus,
  User,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    userId TEXT REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    jurisdiction TEXT NOT NULL,
    clientName TEXT,
    projectType TEXT NOT NULL,
    developmentSummary TEXT NOT NULL,
    preparedBy TEXT,
    manualInputs TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(userId);

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

  try {
    conn.exec(`ALTER TABLE projects ADD COLUMN manualInputs TEXT`);
  } catch (e) {
    const msg = (e as Error).message;
    if (!/duplicate column name/i.test(msg)) throw e;
  }

  try {
    conn.exec(`ALTER TABLE projects ADD COLUMN userId TEXT REFERENCES users(id) ON DELETE CASCADE`);
  } catch (e) {
    const msg = (e as Error).message;
    if (!/duplicate column name/i.test(msg)) throw e;
  }
  conn.exec(`CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(userId)`);
}

type ProjectRow = Omit<Project, "manualInputs"> & { manualInputs: string | null };

function hydrateProject(row: ProjectRow | undefined): Project | undefined {
  if (!row) return undefined;
  const { manualInputs, ...rest } = row;
  const parsed = parseManualInputs(manualInputs);
  return parsed === undefined ? (rest as Project) : ({ ...rest, manualInputs: parsed } as Project);
}

function parseManualInputs(raw: string | null): ManualInputs | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      return parsed as ManualInputs;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function serializeManualInputs(mi: ManualInputs | undefined): string | null {
  if (!mi) return null;
  // Strip empty-string values so we don't persist meaningless entries.
  const cleaned: ManualInputs = {};
  let count = 0;
  for (const k of [
    "growthRate",
    "tripGenAssumptions",
    "mitigationNotes",
    "engineerConclusions",
  ] as const) {
    const v = mi[k];
    if (typeof v === "string" && v.length > 0) {
      cleaned[k] = v;
      count++;
    }
  }
  return count === 0 ? null : JSON.stringify(cleaned);
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

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);
const now = () => new Date().toISOString();

export const projectRepo = {
  list(userId?: string): Project[] {
    const sql = userId
      ? "SELECT * FROM projects WHERE userId = ? ORDER BY createdAt DESC"
      : "SELECT * FROM projects ORDER BY createdAt DESC";
    const stmt = db().prepare(sql);
    const rows = (userId ? stmt.all(userId) : stmt.all()) as ProjectRow[];
    return rows.map((r) => hydrateProject(r)!);
  },
  get(id: string): Project | undefined {
    const row = db().prepare("SELECT * FROM projects WHERE id = ?").get(id) as
      | ProjectRow
      | undefined;
    return hydrateProject(row);
  },
  create(input: Omit<Project, "id" | "createdAt">): Project {
    const project: Project = { ...input, id: uid(), createdAt: now() };
    db()
      .prepare(
        `
      INSERT INTO projects (id, userId, name, location, jurisdiction, clientName, projectType, developmentSummary, preparedBy, manualInputs, createdAt)
      VALUES (@id, @userId, @name, @location, @jurisdiction, @clientName, @projectType, @developmentSummary, @preparedBy, @manualInputs, @createdAt)
    `,
      )
      .run({
        ...project,
        userId: project.userId ?? null,
        clientName: project.clientName ?? null,
        preparedBy: project.preparedBy ?? null,
        manualInputs: serializeManualInputs(project.manualInputs),
      });
    // Re-read so empty manualInputs round-trips to undefined consistently.
    return projectRepo.get(project.id)!;
  },
  update(id: string, patch: Partial<Omit<Project, "id" | "createdAt">>): Project | undefined {
    const conn = db();
    const existing = conn.prepare("SELECT id FROM projects WHERE id = ?").get(id) as
      | { id: string }
      | undefined;
    if (!existing) return undefined;
    const allowed = [
      "name",
      "location",
      "jurisdiction",
      "clientName",
      "projectType",
      "developmentSummary",
      "preparedBy",
      "manualInputs",
    ] as const;
    const fields: string[] = [];
    const values: (string | null)[] = [];
    for (const key of allowed) {
      if (key in patch) {
        fields.push(`${key} = ?`);
        const v = patch[key];
        if (key === "manualInputs") {
          values.push(serializeManualInputs(v as ManualInputs | undefined));
        } else {
          values.push(v === undefined ? null : (v as string));
        }
      }
    }
    if (fields.length === 0) return projectRepo.get(id);
    conn.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);
    return projectRepo.get(id);
  },
  delete(id: string): boolean {
    const info = db().prepare("DELETE FROM projects WHERE id = ?").run(id);
    return info.changes > 0;
  },
};

export const trafficRepo = {
  listByProject(projectId: string): TrafficCountRow[] {
    return db()
      .prepare("SELECT * FROM traffic_counts WHERE projectId = ?")
      .all(projectId) as TrafficCountRow[];
  },
  replaceForProject(
    projectId: string,
    rows: Omit<TrafficCountRow, "id" | "projectId">[],
  ): TrafficCountRow[] {
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
      .prepare(
        `SELECT id, title, "order", content, status, machineBaseline FROM report_sections WHERE reportId = ? ORDER BY "order"`,
      )
      .all(id) as ReportSection[];
    return { ...row, sections };
  },
  getByProject(projectId: string): Report | undefined {
    const conn = db();
    const row = conn.prepare("SELECT id FROM reports WHERE projectId = ?").get(projectId) as
      | { id: string }
      | undefined;
    if (!row) return undefined;
    return reportRepo.get(row.id);
  },
  upsertForProject(projectId: string, sections: ReportSection[]): Report {
    const conn = db();
    const existing = conn.prepare("SELECT id FROM reports WHERE projectId = ?").get(projectId) as
      | { id: string }
      | undefined;
    const reportId = existing?.id ?? uid();
    const ts = now();
    const tx = conn.transaction(() => {
      if (existing) {
        conn.prepare("UPDATE reports SET updatedAt = ? WHERE id = ?").run(ts, reportId);
        conn.prepare("DELETE FROM report_sections WHERE reportId = ?").run(reportId);
      } else {
        conn
          .prepare("INSERT INTO reports (id, projectId, createdAt, updatedAt) VALUES (?, ?, ?, ?)")
          .run(reportId, projectId, ts, ts);
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
  updateSection(
    reportId: string,
    sectionId: string,
    patch: Partial<Pick<ReportSection, "content" | "status" | "title">>,
  ): Report | undefined {
    const conn = db();
    const fields: string[] = [];
    const values: (string | SectionStatus)[] = [];
    if (patch.content !== undefined) {
      fields.push("content = ?");
      values.push(patch.content);
    }
    if (patch.status !== undefined) {
      fields.push("status = ?");
      values.push(patch.status);
    }
    if (patch.title !== undefined) {
      fields.push("title = ?");
      values.push(patch.title);
    }
    if (fields.length === 0) return reportRepo.get(reportId);
    conn
      .prepare(`UPDATE report_sections SET ${fields.join(", ")} WHERE reportId = ? AND id = ?`)
      .run(...values, reportId, sectionId);
    conn.prepare("UPDATE reports SET updatedAt = ? WHERE id = ?").run(now(), reportId);
    return reportRepo.get(reportId);
  },
};

type UserRow = User & { passwordHash: string };

export const userRepo = {
  findByEmail(email: string): (User & { passwordHash: string }) | undefined {
    return db().prepare("SELECT * FROM users WHERE email = ?").get(email.toLowerCase()) as
      | UserRow
      | undefined;
  },
  findById(id: string): User | undefined {
    const row = db()
      .prepare("SELECT id, email, name, createdAt FROM users WHERE id = ?")
      .get(id) as User | undefined;
    return row;
  },
  count(): number {
    const row = db().prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
    return row.n;
  },
  create(input: { email: string; passwordHash: string; name: string }): User {
    const user: User = {
      id: uid(),
      email: input.email.toLowerCase(),
      name: input.name,
      createdAt: now(),
    };
    db()
      .prepare(
        "INSERT INTO users (id, email, passwordHash, name, createdAt) VALUES (@id, @email, @passwordHash, @name, @createdAt)",
      )
      .run({ ...user, passwordHash: input.passwordHash });
    return user;
  },
  claimOrphanProjects(userId: string): number {
    const info = db().prepare("UPDATE projects SET userId = ? WHERE userId IS NULL").run(userId);
    return info.changes;
  },
  updatePassword(userId: string, passwordHash: string): boolean {
    const info = db()
      .prepare("UPDATE users SET passwordHash = ? WHERE id = ?")
      .run(passwordHash, userId);
    return info.changes > 0;
  },
};

export type { Period };
