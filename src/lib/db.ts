import postgres from "postgres";
import type { Sql } from "postgres";
import { runMigrations } from "./migrate";
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

type ProjectRow = Omit<Project, "manualInputs"> & { manualInputs: ManualInputs | null };

function hydrateProject(row: ProjectRow | undefined): Project | undefined {
  if (!row) return undefined;
  const { manualInputs, ...rest } = row;
  const cleaned = cleanManualInputs(manualInputs);
  return cleaned === undefined
    ? (rest as Project)
    : ({ ...rest, manualInputs: cleaned } as Project);
}

function cleanManualInputs(raw: ManualInputs | null | undefined): ManualInputs | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw !== "object") return undefined;
  const cleaned: ManualInputs = {};
  let count = 0;
  for (const k of [
    "growthRate",
    "tripGenAssumptions",
    "mitigationNotes",
    "engineerConclusions",
  ] as const) {
    const v = (raw as ManualInputs)[k];
    if (typeof v === "string" && v.length > 0) {
      cleaned[k] = v;
      count++;
    }
  }
  return count === 0 ? undefined : cleaned;
}

function serializeManualInputs(mi: ManualInputs | undefined): ManualInputs | null {
  if (!mi) return null;
  const cleaned = cleanManualInputs(mi);
  return cleaned ?? null;
}

let _sql: Sql | null = null;
let _migrationPromise: Promise<void> | null = null;

function buildClient(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Configure Postgres before using the app.");
  }
  const schema = process.env.DATABASE_SCHEMA;
  return postgres(url, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connection: schema ? { search_path: `"${schema}", public` } : undefined,
    onnotice: () => {},
  });
}

export function db(): Sql {
  if (_sql) return _sql;
  _sql = buildClient();
  return _sql;
}

export async function ensureMigrated(): Promise<void> {
  if (!_migrationPromise) {
    _migrationPromise = runMigrations(db());
  }
  await _migrationPromise;
}

export async function closeDb(): Promise<void> {
  if (_sql) {
    const s = _sql;
    _sql = null;
    _migrationPromise = null;
    await s.end({ timeout: 5 });
  }
}

const uid = () =>
  globalThis.crypto?.randomUUID?.() ??
  Math.random().toString(36).slice(2) + Date.now().toString(36);
const now = () => new Date().toISOString();

export const projectRepo = {
  async list(userId?: string): Promise<Project[]> {
    const sql = db();
    const rows = userId
      ? ((await sql`SELECT * FROM projects WHERE "userId" = ${userId} ORDER BY "createdAt" DESC`) as unknown as ProjectRow[])
      : ((await sql`SELECT * FROM projects ORDER BY "createdAt" DESC`) as unknown as ProjectRow[]);
    return rows.map((r) => hydrateProject(r)!);
  },
  async listAccessible(userId: string): Promise<ProjectListEntry[]> {
    const sql = db();
    const owned = (await sql`
      SELECT * FROM projects WHERE "userId" = ${userId} ORDER BY "createdAt" DESC
    `) as unknown as ProjectRow[];
    const shared = (await sql`
      SELECT p.* FROM projects p
      INNER JOIN project_shares s ON s."projectId" = p.id
      WHERE s."userId" = ${userId} AND (p."userId" IS NULL OR p."userId" != ${userId})
      ORDER BY p."createdAt" DESC
    `) as unknown as ProjectRow[];
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
  async get(id: string): Promise<Project | undefined> {
    const sql = db();
    const rows = (await sql`SELECT * FROM projects WHERE id = ${id}`) as unknown as ProjectRow[];
    return hydrateProject(rows[0]);
  },
  async create(input: Omit<Project, "id" | "createdAt">): Promise<Project> {
    const sql = db();
    const project: Project = { ...input, id: uid(), createdAt: now() };
    const mi = serializeManualInputs(project.manualInputs);
    await sql`
      INSERT INTO projects (id, "userId", name, location, jurisdiction, "clientName", "projectType", "developmentSummary", "preparedBy", "manualInputs", "createdAt")
      VALUES (
        ${project.id},
        ${project.userId ?? null},
        ${project.name},
        ${project.location},
        ${project.jurisdiction},
        ${project.clientName ?? null},
        ${project.projectType},
        ${project.developmentSummary},
        ${project.preparedBy ?? null},
        ${sql.json(mi as never)},
        ${project.createdAt}
      )
    `;
    return (await projectRepo.get(project.id))!;
  },
  async update(
    id: string,
    patch: Partial<Omit<Project, "id" | "createdAt">>,
  ): Promise<Project | undefined> {
    const sql = db();
    const existing = (await sql`SELECT id FROM projects WHERE id = ${id}`) as unknown as {
      id: string;
    }[];
    if (existing.length === 0) return undefined;
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
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in patch) {
        const v = patch[key];
        updates[key] =
          key === "manualInputs"
            ? serializeManualInputs(v as ManualInputs | undefined)
            : v === undefined
              ? null
              : v;
      }
    }
    const keys = Object.keys(updates);
    if (keys.length === 0) return projectRepo.get(id);
    await sql`UPDATE projects SET ${sql(updates, ...keys)} WHERE id = ${id}`;
    return projectRepo.get(id);
  },
  async delete(id: string): Promise<boolean> {
    const sql = db();
    const result = await sql`DELETE FROM projects WHERE id = ${id}`;
    return result.count > 0;
  },
};

export const trafficRepo = {
  async listByProject(projectId: string): Promise<TrafficCountRow[]> {
    const sql = db();
    return (await sql`
      SELECT * FROM traffic_counts WHERE "projectId" = ${projectId}
    `) as unknown as TrafficCountRow[];
  },
  async getRow(projectId: string, rowId: string): Promise<TrafficCountRow | undefined> {
    const sql = db();
    const rows = (await sql`
      SELECT * FROM traffic_counts WHERE "projectId" = ${projectId} AND id = ${rowId}
    `) as unknown as TrafficCountRow[];
    return rows[0];
  },
  async addRow(
    projectId: string,
    row: Omit<TrafficCountRow, "id" | "projectId">,
  ): Promise<TrafficCountRow> {
    const sql = db();
    const full: TrafficCountRow = { ...row, id: uid(), projectId };
    await sql`
      INSERT INTO traffic_counts (id, "projectId", intersection, period, approach, inbound, outbound, total)
      VALUES (
        ${full.id}, ${full.projectId}, ${full.intersection}, ${full.period},
        ${full.approach ?? null}, ${full.inbound}, ${full.outbound}, ${full.total}
      )
    `;
    return full;
  },
  async updateRow(
    projectId: string,
    rowId: string,
    patch: Partial<Omit<TrafficCountRow, "id" | "projectId">>,
  ): Promise<TrafficCountRow | undefined> {
    const sql = db();
    const existing = await trafficRepo.getRow(projectId, rowId);
    if (!existing) return undefined;
    const allowed = ["intersection", "period", "approach", "inbound", "outbound", "total"] as const;
    const updates: Record<string, string | number | null> = {};
    for (const key of allowed) {
      if (key in patch) {
        const v = patch[key];
        if (key === "approach") {
          updates[key] = v === undefined || v === null || v === "" ? null : (v as string);
        } else if (key === "inbound" || key === "outbound" || key === "total") {
          updates[key] = v as number;
        } else {
          updates[key] = v as string;
        }
      }
    }
    const keys = Object.keys(updates);
    if (keys.length === 0) return existing;
    await sql`
      UPDATE traffic_counts SET ${sql(updates, ...keys)}
      WHERE "projectId" = ${projectId} AND id = ${rowId}
    `;
    return trafficRepo.getRow(projectId, rowId);
  },
  async deleteRow(projectId: string, rowId: string): Promise<boolean> {
    const sql = db();
    const result = await sql`
      DELETE FROM traffic_counts WHERE "projectId" = ${projectId} AND id = ${rowId}
    `;
    return result.count > 0;
  },
  async replaceForProject(
    projectId: string,
    rows: Omit<TrafficCountRow, "id" | "projectId">[],
  ): Promise<TrafficCountRow[]> {
    const sql = db();
    return sql.begin(async (tx) => {
      await tx`DELETE FROM traffic_counts WHERE "projectId" = ${projectId}`;
      const out: TrafficCountRow[] = [];
      for (const r of rows) {
        const full: TrafficCountRow = { ...r, id: uid(), projectId };
        await tx`
          INSERT INTO traffic_counts (id, "projectId", intersection, period, approach, inbound, outbound, total)
          VALUES (
            ${full.id}, ${full.projectId}, ${full.intersection}, ${full.period},
            ${full.approach ?? null}, ${full.inbound}, ${full.outbound}, ${full.total}
          )
        `;
        out.push(full);
      }
      return out;
    }) as Promise<TrafficCountRow[]>;
  },
};

export const reportRepo = {
  async get(id: string): Promise<Report | undefined> {
    const sql = db();
    const rows = (await sql`SELECT * FROM reports WHERE id = ${id}`) as unknown as {
      id: string;
      projectId: string;
      createdAt: string;
      updatedAt: string;
    }[];
    if (rows.length === 0) return undefined;
    const sections = (await sql`
      SELECT id, title, "order", content, status, "machineBaseline", kind
      FROM report_sections WHERE "reportId" = ${id} ORDER BY "order"
    `) as unknown as ReportSection[];
    return { ...rows[0], sections };
  },
  async getByProject(projectId: string): Promise<Report | undefined> {
    const sql = db();
    const rows = (await sql`
      SELECT id FROM reports WHERE "projectId" = ${projectId}
    `) as unknown as { id: string }[];
    if (rows.length === 0) return undefined;
    return reportRepo.get(rows[0].id);
  },
  async upsertForProject(projectId: string, sections: ReportSection[]): Promise<Report> {
    const sql = db();
    const reportId = await sql.begin(async (tx) => {
      const existing = (await tx`
        SELECT id FROM reports WHERE "projectId" = ${projectId}
      `) as unknown as { id: string }[];
      const id = existing[0]?.id ?? uid();
      const ts = now();
      if (existing.length > 0) {
        await tx`UPDATE reports SET "updatedAt" = ${ts} WHERE id = ${id}`;
        await tx`DELETE FROM report_sections WHERE "reportId" = ${id}`;
      } else {
        await tx`
          INSERT INTO reports (id, "projectId", "createdAt", "updatedAt")
          VALUES (${id}, ${projectId}, ${ts}, ${ts})
        `;
      }
      for (const s of sections) {
        await tx`
          INSERT INTO report_sections (id, "reportId", title, "order", content, status, "machineBaseline", kind)
          VALUES (
            ${s.id}, ${id}, ${s.title}, ${s.order}, ${s.content}, ${s.status},
            ${s.machineBaseline ?? null}, ${s.kind ?? "standard"}
          )
        `;
      }
      return id;
    });
    return (await reportRepo.get(reportId as string))!;
  },
  async updateSection(
    reportId: string,
    sectionId: string,
    patch: Partial<Pick<ReportSection, "content" | "status" | "title" | "machineBaseline">>,
  ): Promise<Report | undefined> {
    const sql = db();
    const updates: Record<string, string | SectionStatus | null> = {};
    if (patch.content !== undefined) updates.content = patch.content;
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.machineBaseline !== undefined) updates.machineBaseline = patch.machineBaseline;
    const keys = Object.keys(updates);
    if (keys.length === 0) return reportRepo.get(reportId);
    await sql`
      UPDATE report_sections SET ${sql(updates, ...keys)}
      WHERE "reportId" = ${reportId} AND id = ${sectionId}
    `;
    await sql`UPDATE reports SET "updatedAt" = ${now()} WHERE id = ${reportId}`;
    return reportRepo.get(reportId);
  },
  async reorderSections(reportId: string, orderedIds: string[]): Promise<boolean> {
    const sql = db();
    return sql.begin(async (tx) => {
      const existing = (await tx`
        SELECT id FROM report_sections WHERE "reportId" = ${reportId}
      `) as unknown as { id: string }[];
      const existingIds = existing.map((r) => r.id).sort();
      const requested = [...orderedIds].sort();
      if (
        existingIds.length !== requested.length ||
        new Set(orderedIds).size !== orderedIds.length ||
        existingIds.some((id, i) => id !== requested[i])
      ) {
        return false;
      }
      for (let idx = 0; idx < orderedIds.length; idx++) {
        await tx`
          UPDATE report_sections SET "order" = ${idx + 1}
          WHERE "reportId" = ${reportId} AND id = ${orderedIds[idx]}
        `;
      }
      await tx`UPDATE reports SET "updatedAt" = ${now()} WHERE id = ${reportId}`;
      return true;
    }) as Promise<boolean>;
  },
  async addCustomSection(
    reportId: string,
    input: { title: string; content: string },
  ): Promise<ReportSection | undefined> {
    const sql = db();
    const exists = (await sql`SELECT id FROM reports WHERE id = ${reportId}`) as unknown as {
      id: string;
    }[];
    if (exists.length === 0) return undefined;
    const maxRow = (await sql`
      SELECT MAX("order") AS m FROM report_sections WHERE "reportId" = ${reportId}
    `) as unknown as { m: number | null }[];
    const nextOrder = (maxRow[0]?.m ?? 0) + 1;
    const section: ReportSection = {
      id: uid(),
      title: input.title,
      order: nextOrder,
      content: input.content,
      status: "draft",
      machineBaseline: input.content,
      kind: "custom",
    };
    await sql`
      INSERT INTO report_sections (id, "reportId", title, "order", content, status, "machineBaseline", kind)
      VALUES (
        ${section.id}, ${reportId}, ${section.title}, ${section.order},
        ${section.content}, ${section.status}, ${section.machineBaseline ?? null}, ${section.kind}
      )
    `;
    await sql`UPDATE reports SET "updatedAt" = ${now()} WHERE id = ${reportId}`;
    return section;
  },
  async removeSection(
    reportId: string,
    sectionId: string,
  ): Promise<{ ok: true } | { ok: false; reason: "not_found" | "standard" }> {
    const sql = db();
    const rows = (await sql`
      SELECT kind FROM report_sections WHERE "reportId" = ${reportId} AND id = ${sectionId}
    `) as unknown as { kind: string }[];
    if (rows.length === 0) return { ok: false, reason: "not_found" };
    if (rows[0].kind === "standard") return { ok: false, reason: "standard" };
    await sql`
      DELETE FROM report_sections WHERE "reportId" = ${reportId} AND id = ${sectionId}
    `;
    await sql`UPDATE reports SET "updatedAt" = ${now()} WHERE id = ${reportId}`;
    return { ok: true };
  },
};

type UserRow = User & { passwordHash: string };

export const userRepo = {
  async findByEmail(email: string): Promise<(User & { passwordHash: string }) | undefined> {
    const sql = db();
    const rows = (await sql`
      SELECT id, email, "passwordHash", name, "createdAt", "emailVerifiedAt"
      FROM users WHERE email = ${email.toLowerCase()}
    `) as unknown as UserRow[];
    return rows[0];
  },
  async findById(id: string): Promise<User | undefined> {
    const sql = db();
    const rows = (await sql`
      SELECT id, email, name, "createdAt", "emailVerifiedAt" FROM users WHERE id = ${id}
    `) as unknown as User[];
    return rows[0];
  },
  async count(): Promise<number> {
    const sql = db();
    const rows = (await sql`SELECT COUNT(*)::int AS n FROM users`) as unknown as { n: number }[];
    return rows[0].n;
  },
  async create(input: { email: string; passwordHash: string; name: string }): Promise<User> {
    const sql = db();
    const user: User = {
      id: uid(),
      email: input.email.toLowerCase(),
      name: input.name,
      createdAt: now(),
    };
    await sql`
      INSERT INTO users (id, email, "passwordHash", name, "createdAt")
      VALUES (${user.id}, ${user.email}, ${input.passwordHash}, ${user.name}, ${user.createdAt})
    `;
    return user;
  },
  async claimOrphanProjects(userId: string): Promise<number> {
    const sql = db();
    const result = await sql`UPDATE projects SET "userId" = ${userId} WHERE "userId" IS NULL`;
    return result.count;
  },
  async updatePassword(userId: string, passwordHash: string): Promise<boolean> {
    const sql = db();
    const result = await sql`
      UPDATE users SET "passwordHash" = ${passwordHash} WHERE id = ${userId}
    `;
    return result.count > 0;
  },
  async markEmailVerified(userId: string): Promise<boolean> {
    const sql = db();
    const result = await sql`
      UPDATE users SET "emailVerifiedAt" = ${now()} WHERE id = ${userId}
    `;
    return result.count > 0;
  },
  async updateEmail(userId: string, newEmail: string): Promise<boolean> {
    const sql = db();
    const result = await sql`
      UPDATE users SET email = ${newEmail.toLowerCase()}, "emailVerifiedAt" = ${now()}
      WHERE id = ${userId}
    `;
    return result.count > 0;
  },
  async delete(userId: string): Promise<boolean> {
    // GDPR scrub: rewrite audit_log.details that reference this userId BEFORE
    // the FK cascade (audit_log.userId ON DELETE SET NULL) fires, so target-of-
    // share rows authored by other users still get their details purged. Both
    // ops share a transaction so a partial scrub can't leak data if DELETE fails.
    const sql = db();
    return sql.begin(async (tx) => {
      await scrubUserInTx(tx, userId);
      const result = await tx`DELETE FROM users WHERE id = ${userId}`;
      return result.count > 0;
    }) as Promise<boolean>;
  },
};

export function _dbInternal(): Sql {
  return db();
}

export const shareRepo = {
  async listForProject(
    projectId: string,
  ): Promise<
    Array<{ userId: string; email: string; name: string; role: ShareRole; createdAt: string }>
  > {
    const sql = db();
    return (await sql`
      SELECT s."userId" AS "userId", u.email AS email, u.name AS name,
             s.role AS role, s."createdAt" AS "createdAt"
      FROM project_shares s
      INNER JOIN users u ON u.id = s."userId"
      WHERE s."projectId" = ${projectId}
      ORDER BY s."createdAt" ASC
    `) as unknown as Array<{
      userId: string;
      email: string;
      name: string;
      role: ShareRole;
      createdAt: string;
    }>;
  },
  async add(projectId: string, userId: string, role: ShareRole): Promise<boolean> {
    const sql = db();
    const existing = (await sql`
      SELECT 1 AS x FROM project_shares
      WHERE "projectId" = ${projectId} AND "userId" = ${userId}
    `) as unknown as unknown[];
    if (existing.length > 0) return false;
    await sql`
      INSERT INTO project_shares ("projectId", "userId", role, "createdAt")
      VALUES (${projectId}, ${userId}, ${role}, ${now()})
    `;
    return true;
  },
  async remove(projectId: string, userId: string): Promise<boolean> {
    const sql = db();
    const result = await sql`
      DELETE FROM project_shares WHERE "projectId" = ${projectId} AND "userId" = ${userId}
    `;
    return result.count > 0;
  },
  async accessRole(projectId: string, userId: string): Promise<ProjectAccessRole | null> {
    const sql = db();
    const proj = (await sql`
      SELECT "userId" FROM projects WHERE id = ${projectId}
    `) as unknown as { userId: string | null }[];
    if (proj.length === 0) return null;
    if (proj[0].userId === userId) return "owner";
    const share = (await sql`
      SELECT role FROM project_shares WHERE "projectId" = ${projectId} AND "userId" = ${userId}
    `) as unknown as { role: ShareRole }[];
    if (share.length === 0) return null;
    return share[0].role === "editor" ? "editor" : "reader";
  },
  async updateRole(projectId: string, userId: string, role: ShareRole): Promise<boolean> {
    const sql = db();
    const result = await sql`
      UPDATE project_shares SET role = ${role}
      WHERE "projectId" = ${projectId} AND "userId" = ${userId}
    `;
    return result.count > 0;
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
  details: unknown | null;
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

// tx may be Sql or TransactionSql; both support tagged-template invocation.
// `Sql<{}>` and `TransactionSql<{}>` are not in a subtype relation in postgres' types.
async function scrubUserInTx(tx: Sql | postgres.TransactionSql<{}>, userId: string): Promise<void> {
  if (!userId) return;
  const rows = (await tx`
    SELECT id, details FROM audit_log WHERE details::text LIKE ${"%" + userId + "%"}
  `) as unknown as Array<{ id: string; details: unknown | null }>;
  for (const row of rows) {
    if (!row.details || typeof row.details !== "object") continue;
    const scrubbed = scrubValue(row.details, userId);
    await tx`UPDATE audit_log SET details = ${tx.json(scrubbed as never)} WHERE id = ${row.id}`;
  }
}

export const auditRepo = {
  async log(entry: {
    projectId: string;
    userId: string | null;
    action: AuditAction;
    details?: Record<string, unknown> | string | null;
  }): Promise<void> {
    const sql = db();
    const details =
      entry.details == null
        ? null
        : typeof entry.details === "string"
          ? { _raw: entry.details }
          : entry.details;
    await sql`
      INSERT INTO audit_log (id, "projectId", "userId", action, details, "createdAt")
      VALUES (${uid()}, ${entry.projectId}, ${entry.userId}, ${entry.action},
              ${sql.json(details as never)}, ${now()})
    `;
  },
  // GDPR erasure: rewrite any audit_log.details JSON value that equals the
  // given userId to the string "[scrubbed]". Idempotent.
  // Caller wraps the scrub + delete in a transaction (see userRepo.delete).
  async scrubUser(userId: string): Promise<void> {
    if (!userId) return;
    const sql = db();
    await sql.begin(async (tx) => {
      await scrubUserInTx(tx, userId);
    });
  },
  // Cursor-paginated. limit defaults to 50, clamped to [1,200]. before is an
  // ISO createdAt string from a previously returned row — only strictly older
  // rows are returned.
  async listForProject(
    projectId: string,
    opts: { limit?: number; before?: string } = {},
  ): Promise<AuditEntry[]> {
    const sql = db();
    const DEFAULT_LIMIT = 50;
    const MAX_LIMIT = 200;
    let limit = DEFAULT_LIMIT;
    const raw = opts.limit;
    if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
      limit = Math.min(Math.floor(raw), MAX_LIMIT);
    }
    const before = typeof opts.before === "string" && opts.before.length > 0 ? opts.before : null;
    if (before) {
      return (await sql`
        SELECT a.id, a."projectId", a."userId", a.action, a.details, a."createdAt",
               u.email AS "userEmail"
        FROM audit_log a
        LEFT JOIN users u ON u.id = a."userId"
        WHERE a."projectId" = ${projectId} AND a."createdAt" < ${before}
        ORDER BY a."createdAt" DESC
        LIMIT ${limit}
      `) as unknown as AuditEntry[];
    }
    return (await sql`
      SELECT a.id, a."projectId", a."userId", a.action, a.details, a."createdAt",
             u.email AS "userEmail"
      FROM audit_log a
      LEFT JOIN users u ON u.id = a."userId"
      WHERE a."projectId" = ${projectId}
      ORDER BY a."createdAt" DESC
      LIMIT ${limit}
    `) as unknown as AuditEntry[];
  },
};

export type { Period };
