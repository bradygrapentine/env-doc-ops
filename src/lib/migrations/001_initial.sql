CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  name TEXT NOT NULL,
  "createdAt" TEXT NOT NULL,
  "emailVerifiedAt" TEXT
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  token TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "expiresAt" TEXT NOT NULL,
  "usedAt" TEXT
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "expiresAt" TEXT NOT NULL,
  "usedAt" TEXT
);

CREATE TABLE IF NOT EXISTS email_change_tokens (
  token TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "newEmail" TEXT NOT NULL,
  "expiresAt" TEXT NOT NULL,
  "usedAt" TEXT
);

-- audit_log.projectId intentionally has no FK reference. If a project is
-- deleted, its audit rows must survive so the owner can still see the delete
-- entry. userId uses ON DELETE SET NULL so account deletion preserves the
-- audit trail with attribution dropped.
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "userId" TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details JSONB,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_project ON audit_log("projectId", "createdAt");

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  "userId" TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  jurisdiction TEXT NOT NULL,
  "clientName" TEXT,
  "projectType" TEXT NOT NULL,
  "developmentSummary" TEXT NOT NULL,
  "preparedBy" TEXT,
  "manualInputs" JSONB,
  "createdAt" TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects("userId");

CREATE TABLE IF NOT EXISTS traffic_counts (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  intersection TEXT NOT NULL,
  period TEXT NOT NULL,
  approach TEXT,
  inbound INTEGER NOT NULL,
  outbound INTEGER NOT NULL,
  total INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_traffic_project ON traffic_counts("projectId");

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "createdAt" TEXT NOT NULL,
  "updatedAt" TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_shares (
  "projectId" TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('reader', 'editor')),
  "createdAt" TEXT NOT NULL,
  PRIMARY KEY ("projectId", "userId")
);
CREATE INDEX IF NOT EXISTS idx_shares_user ON project_shares("userId");

CREATE TABLE IF NOT EXISTS report_sections (
  id TEXT NOT NULL,
  "reportId" TEXT NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL,
  "machineBaseline" TEXT,
  kind TEXT NOT NULL DEFAULT 'standard',
  PRIMARY KEY ("reportId", id)
);
