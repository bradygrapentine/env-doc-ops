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
  ProjectListEntry,
  ShareRole,
  ProjectAccessRole,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    emailVerifiedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS verification_tokens (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiresAt TEXT NOT NULL,
    usedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expiresAt TEXT NOT NULL,
    usedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS email_change_tokens (
    token TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    newEmail TEXT NOT NULL,
    expiresAt TEXT NOT NULL,
    usedAt TEXT
  );

  -- audit_log.projectId intentionally has no FK reference. If a project is
  -- deleted, its audit rows must survive so the owner can still see "what
  -- happened, including the delete" — a CASCADE here would silently wipe the
  -- very row that recorded the deletion. userId uses ON DELETE SET NULL so
  -- account deletion preserves the audit trail with attribution dropped.
  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    projectId TEXT NOT NULL,
    userId TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    details TEXT,
    createdAt TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log(projectId, createdAt);

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

  CREATE TABLE IF NOT EXISTS project_shares (
    projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK(role IN ('reader','editor')),
    createdAt TEXT NOT NULL,
    PRIMARY KEY (projectId, userId)
  );
  CREATE INDEX IF NOT EXISTS idx_shares_user ON project_shares(userId);

  CREATE TABLE IF NOT EXISTS report_sections (
    id TEXT NOT NULL,
    reportId TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    content TEXT NOT NULL,
    status TEXT NOT NULL,
    machineBaseline TEXT,
    kind TEXT NOT NULL DEFAULT 'standard',
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

  try {
    conn.exec(`ALTER TABLE report_sections ADD COLUMN kind TEXT NOT NULL DEFAULT 'standard'`);
  } catch (e) {
    const msg = (e as Error).message;
    if (!/duplicate column name/i.test(msg)) throw e;
  }
  conn.exec(`UPDATE report_sections SET kind = 'standard' WHERE kind IS NULL OR kind = ''`);

  try {
    conn.exec(`ALTER TABLE users ADD COLUMN emailVerifiedAt TEXT`);
  } catch (e) {
    const msg = (e as Error).message;
    if (!/duplicate column name/i.test(msg)) throw e;
  }

  // Widen project_shares.role CHECK to allow 'editor'. SQLite cannot ALTER a
  // CHECK constraint, so when the old definition is detected we rebuild the
  // table in place. Idempotent: skips if the definition already permits editor.
  const sharesDef = conn
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'project_shares'")
    .get() as { sql?: string } | undefined;
  if (sharesDef?.sql && !sharesDef.sql.includes("'editor'")) {
    // Wrap in a transaction so a crash between DROP and RENAME doesn't
    // leave the database without a project_shares table. better-sqlite3's
    // conn.exec on multi-statement SQL is NOT implicitly transactional.
    conn.transaction(() => {
      conn.exec(`
        CREATE TABLE project_shares__new (
          projectId TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
          userId TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK(role IN ('reader','editor')),
          createdAt TEXT NOT NULL,
          PRIMARY KEY (projectId, userId)
        );
        INSERT INTO project_shares__new (projectId, userId, role, createdAt)
          SELECT projectId, userId, role, createdAt FROM project_shares;
        DROP TABLE project_shares;
        ALTER TABLE project_shares__new RENAME TO project_shares;
        CREATE INDEX IF NOT EXISTS idx_shares_user ON project_shares(userId);
      `);
    })();
  }

  // Drop the audit_log.projectId FK if a previous schema had it. The first
  // shipped audit_log used ON DELETE CASCADE which silently wiped the
  // project.delete row alongside the project. Rebuild without the FK.
  const auditDef = conn
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'audit_log'")
    .get() as { sql?: string } | undefined;
  if (auditDef?.sql && /REFERENCES\s+projects/i.test(auditDef.sql)) {
    conn.transaction(() => {
      conn.exec(`
        CREATE TABLE audit_log__new (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          userId TEXT REFERENCES users(id) ON DELETE SET NULL,
          action TEXT NOT NULL,
          details TEXT,
          createdAt TEXT NOT NULL
        );
        INSERT INTO audit_log__new SELECT id, projectId, userId, action, details, createdAt FROM audit_log;
        DROP TABLE audit_log;
        ALTER TABLE audit_log__new RENAME TO audit_log;
        CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log(projectId, createdAt);
      `);
    })();
  }
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
  listAccessible(userId: string): ProjectListEntry[] {
    const conn = db();
    const owned = conn
      .prepare("SELECT * FROM projects WHERE userId = ? ORDER BY createdAt DESC")
      .all(userId) as ProjectRow[];
    const shared = conn
      .prepare(
        `SELECT p.* FROM projects p
         INNER JOIN project_shares s ON s.projectId = p.id
         WHERE s.userId = ? AND (p.userId IS NULL OR p.userId != ?)
         ORDER BY p.createdAt DESC`,
      )
      .all(userId, userId) as ProjectRow[];
    const seen = new Set<string>();
    const out: ProjectListEntry[] = [];
    for (const r of owned) {
      const p = hydrateProject(r)!;
      seen.add(p.id);
      out.push({ ...p, role: "owner" });
    }
    for (const r of shared) {
      const p = hydrateProject(r)!;
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      out.push({ ...p, role: "reader" });
    }
    return out;
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
  getRow(projectId: string, rowId: string): TrafficCountRow | undefined {
    return db()
      .prepare("SELECT * FROM traffic_counts WHERE projectId = ? AND id = ?")
      .get(projectId, rowId) as TrafficCountRow | undefined;
  },
  addRow(projectId: string, row: Omit<TrafficCountRow, "id" | "projectId">): TrafficCountRow {
    const full: TrafficCountRow = { ...row, id: uid(), projectId };
    db()
      .prepare(
        `INSERT INTO traffic_counts (id, projectId, intersection, period, approach, inbound, outbound, total)
         VALUES (@id, @projectId, @intersection, @period, @approach, @inbound, @outbound, @total)`,
      )
      .run({ ...full, approach: full.approach ?? null });
    return full;
  },
  updateRow(
    projectId: string,
    rowId: string,
    patch: Partial<Omit<TrafficCountRow, "id" | "projectId">>,
  ): TrafficCountRow | undefined {
    const conn = db();
    const existing = conn
      .prepare("SELECT * FROM traffic_counts WHERE projectId = ? AND id = ?")
      .get(projectId, rowId) as TrafficCountRow | undefined;
    if (!existing) return undefined;
    const allowed = ["intersection", "period", "approach", "inbound", "outbound", "total"] as const;
    const fields: string[] = [];
    const values: (string | number | null)[] = [];
    for (const key of allowed) {
      if (key in patch) {
        fields.push(`${key} = ?`);
        const v = patch[key];
        if (key === "approach") {
          values.push(v === undefined || v === null || v === "" ? null : (v as string));
        } else if (key === "inbound" || key === "outbound" || key === "total") {
          values.push(v as number);
        } else {
          values.push(v as string);
        }
      }
    }
    if (fields.length === 0) {
      return existing;
    }
    conn
      .prepare(`UPDATE traffic_counts SET ${fields.join(", ")} WHERE projectId = ? AND id = ?`)
      .run(...values, projectId, rowId);
    return conn
      .prepare("SELECT * FROM traffic_counts WHERE projectId = ? AND id = ?")
      .get(projectId, rowId) as TrafficCountRow | undefined;
  },
  deleteRow(projectId: string, rowId: string): boolean {
    const info = db()
      .prepare("DELETE FROM traffic_counts WHERE projectId = ? AND id = ?")
      .run(projectId, rowId);
    return info.changes > 0;
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
        `SELECT id, title, "order", content, status, machineBaseline, kind FROM report_sections WHERE reportId = ? ORDER BY "order"`,
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
        INSERT INTO report_sections (id, reportId, title, "order", content, status, machineBaseline, kind)
        VALUES (@id, @reportId, @title, @order, @content, @status, @machineBaseline, @kind)
      `);
      for (const s of sections) insertSection.run({ ...s, reportId, kind: s.kind ?? "standard" });
    });
    tx();
    return reportRepo.get(reportId)!;
  },
  updateSection(
    reportId: string,
    sectionId: string,
    patch: Partial<Pick<ReportSection, "content" | "status" | "title" | "machineBaseline">>,
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
    if (patch.machineBaseline !== undefined) {
      fields.push("machineBaseline = ?");
      values.push(patch.machineBaseline);
    }
    if (fields.length === 0) return reportRepo.get(reportId);
    conn
      .prepare(`UPDATE report_sections SET ${fields.join(", ")} WHERE reportId = ? AND id = ?`)
      .run(...values, reportId, sectionId);
    conn.prepare("UPDATE reports SET updatedAt = ? WHERE id = ?").run(now(), reportId);
    return reportRepo.get(reportId);
  },
  reorderSections(reportId: string, orderedIds: string[]): boolean {
    const conn = db();
    const tx = conn.transaction(() => {
      const existing = conn
        .prepare(`SELECT id FROM report_sections WHERE reportId = ?`)
        .all(reportId) as { id: string }[];
      const existingIds = existing.map((r) => r.id).sort();
      const requested = [...orderedIds].sort();
      if (
        existingIds.length !== requested.length ||
        new Set(orderedIds).size !== orderedIds.length ||
        existingIds.some((id, i) => id !== requested[i])
      ) {
        return false;
      }
      const upd = conn.prepare(
        `UPDATE report_sections SET "order" = ? WHERE reportId = ? AND id = ?`,
      );
      orderedIds.forEach((id, idx) => upd.run(idx + 1, reportId, id));
      conn.prepare("UPDATE reports SET updatedAt = ? WHERE id = ?").run(now(), reportId);
      return true;
    });
    return tx() as boolean;
  },
  addCustomSection(
    reportId: string,
    input: { title: string; content: string },
  ): ReportSection | undefined {
    const conn = db();
    const exists = conn.prepare("SELECT id FROM reports WHERE id = ?").get(reportId);
    if (!exists) return undefined;
    const row = conn
      .prepare(`SELECT MAX("order") AS m FROM report_sections WHERE reportId = ?`)
      .get(reportId) as { m: number | null };
    const nextOrder = (row?.m ?? 0) + 1;
    const section: ReportSection = {
      id: uid(),
      title: input.title,
      order: nextOrder,
      content: input.content,
      status: "draft",
      machineBaseline: input.content,
      kind: "custom",
    };
    conn
      .prepare(
        `INSERT INTO report_sections (id, reportId, title, "order", content, status, machineBaseline, kind)
         VALUES (@id, @reportId, @title, @order, @content, @status, @machineBaseline, @kind)`,
      )
      .run({ ...section, reportId });
    conn.prepare("UPDATE reports SET updatedAt = ? WHERE id = ?").run(now(), reportId);
    return section;
  },
  removeSection(
    reportId: string,
    sectionId: string,
  ): { ok: true } | { ok: false; reason: "not_found" | "standard" } {
    const conn = db();
    const row = conn
      .prepare(`SELECT kind FROM report_sections WHERE reportId = ? AND id = ?`)
      .get(reportId, sectionId) as { kind: string } | undefined;
    if (!row) return { ok: false, reason: "not_found" };
    if (row.kind === "standard") return { ok: false, reason: "standard" };
    conn
      .prepare(`DELETE FROM report_sections WHERE reportId = ? AND id = ?`)
      .run(reportId, sectionId);
    conn.prepare("UPDATE reports SET updatedAt = ? WHERE id = ?").run(now(), reportId);
    return { ok: true };
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
      .prepare("SELECT id, email, name, createdAt, emailVerifiedAt FROM users WHERE id = ?")
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
  markEmailVerified(userId: string): boolean {
    const info = db()
      .prepare("UPDATE users SET emailVerifiedAt = ? WHERE id = ?")
      .run(now(), userId);
    return info.changes > 0;
  },
  updateEmail(userId: string, newEmail: string): boolean {
    const info = db()
      .prepare("UPDATE users SET email = ?, emailVerifiedAt = ? WHERE id = ?")
      .run(newEmail.toLowerCase(), now(), userId);
    return info.changes > 0;
  },
  delete(userId: string): boolean {
    // GDPR scrub: rewrite audit_log.details that reference this userId BEFORE
    // the FK cascade (audit_log.userId ON DELETE SET NULL) fires, so target-of-
    // share rows authored by other users still get their details purged. The
    // two ops share a transaction so a partial scrub can't leak data if the
    // DELETE fails.
    let deleted = false;
    db().transaction(() => {
      auditRepo.scrubUser(userId);
      const info = db().prepare("DELETE FROM users WHERE id = ?").run(userId);
      deleted = info.changes > 0;
    })();
    return deleted;
  },
};

export function _dbInternal(): Database.Database {
  return db();
}

export const shareRepo = {
  listForProject(
    projectId: string,
  ): Array<{ userId: string; email: string; name: string; role: ShareRole; createdAt: string }> {
    return db()
      .prepare(
        `SELECT s.userId AS userId, u.email AS email, u.name AS name, s.role AS role, s.createdAt AS createdAt
         FROM project_shares s
         INNER JOIN users u ON u.id = s.userId
         WHERE s.projectId = ?
         ORDER BY s.createdAt ASC`,
      )
      .all(projectId) as Array<{
      userId: string;
      email: string;
      name: string;
      role: ShareRole;
      createdAt: string;
    }>;
  },
  add(projectId: string, userId: string, role: ShareRole): boolean {
    const existing = db()
      .prepare("SELECT 1 FROM project_shares WHERE projectId = ? AND userId = ?")
      .get(projectId, userId);
    if (existing) return false;
    db()
      .prepare(
        `INSERT INTO project_shares (projectId, userId, role, createdAt) VALUES (?, ?, ?, ?)`,
      )
      .run(projectId, userId, role, now());
    return true;
  },
  remove(projectId: string, userId: string): boolean {
    const info = db()
      .prepare("DELETE FROM project_shares WHERE projectId = ? AND userId = ?")
      .run(projectId, userId);
    return info.changes > 0;
  },
  accessRole(projectId: string, userId: string): ProjectAccessRole | null {
    const conn = db();
    const proj = conn.prepare("SELECT userId FROM projects WHERE id = ?").get(projectId) as
      | { userId: string | null }
      | undefined;
    if (!proj) return null;
    if (proj.userId === userId) return "owner";
    const share = conn
      .prepare("SELECT role FROM project_shares WHERE projectId = ? AND userId = ?")
      .get(projectId, userId) as { role: ShareRole } | undefined;
    if (!share) return null;
    return share.role === "editor" ? "editor" : "reader";
  },
  updateRole(projectId: string, userId: string, role: ShareRole): boolean {
    const info = db()
      .prepare("UPDATE project_shares SET role = ? WHERE projectId = ? AND userId = ?")
      .run(role, projectId, userId);
    return info.changes > 0;
  },
};

export type AuditAction =
  | "project.update"
  | "project.delete"
  | "traffic.import"
  | "report.generate"
  | "report.regenerate"
  | "section.update"
  | "section.regenerate"
  | "section.add"
  | "section.delete"
  | "section.reorder"
  | "share.add"
  | "share.remove"
  | "share.role_change";

export type AuditEntry = {
  id: string;
  projectId: string;
  userId: string | null;
  action: AuditAction;
  details: string | null;
  createdAt: string;
  userEmail?: string | null;
};

function scrubValue(value: unknown, userId: string): unknown {
  if (typeof value === "string") {
    return value === userId ? "[scrubbed]" : value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => scrubValue(v, userId));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubValue(v, userId);
    }
    return out;
  }
  return value;
}

export const auditRepo = {
  log(entry: {
    projectId: string;
    userId: string | null;
    action: AuditAction;
    details?: Record<string, unknown> | string | null;
  }): void {
    const detailsStr =
      entry.details == null
        ? null
        : typeof entry.details === "string"
          ? entry.details
          : JSON.stringify(entry.details);
    db()
      .prepare(
        `INSERT INTO audit_log (id, projectId, userId, action, details, createdAt) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(uid(), entry.projectId, entry.userId, entry.action, detailsStr, now());
  },
  // GDPR erasure: rewrite any audit_log.details JSON value that equals the
  // given userId to the string "[scrubbed]". Targets both rows authored by
  // the user (FK SET NULL handles userId) and rows where the user appears as
  // a `targetUserId` in share-event details (FK doesn't help there). Action
  // and createdAt are preserved — the audit history stays intact, only the
  // personal identifier is purged. Idempotent: a second call has no effect
  // because "[scrubbed]" no longer matches the userId substring.
  scrubUser(userId: string): void {
    if (!userId) return;
    const rows = db()
      .prepare("SELECT id, details FROM audit_log WHERE details LIKE ?")
      .all(`%${userId}%`) as Array<{ id: string; details: string | null }>;
    const update = db().prepare("UPDATE audit_log SET details = ? WHERE id = ?");
    db().transaction(() => {
      for (const row of rows) {
        if (!row.details) continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(row.details);
        } catch {
          // non-JSON details: fall back to raw string replace
          const replaced = row.details.split(userId).join("[scrubbed]");
          if (replaced !== row.details) update.run(replaced, row.id);
          continue;
        }
        const scrubbed = scrubValue(parsed, userId);
        const next = JSON.stringify(scrubbed);
        if (next !== row.details) update.run(next, row.id);
      }
    })();
  },
  listForProject(projectId: string, limit = 100): AuditEntry[] {
    return db()
      .prepare(
        `SELECT a.id, a.projectId, a.userId, a.action, a.details, a.createdAt, u.email AS userEmail
         FROM audit_log a
         LEFT JOIN users u ON u.id = a.userId
         WHERE a.projectId = ?
         ORDER BY a.createdAt DESC
         LIMIT ?`,
      )
      .all(projectId, limit) as AuditEntry[];
  },
};

export type { Period };
