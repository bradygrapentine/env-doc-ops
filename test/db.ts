import { db } from "@/lib/db";

// Truncate all app tables in one statement. CASCADE handles FK chains.
// schema_migrations is preserved so the migration runner doesn't re-apply.
const TABLES = [
  "audit_log",
  "report_sections",
  "reports",
  "traffic_counts",
  "project_shares",
  "projects",
  "verification_tokens",
  "password_reset_tokens",
  "email_change_tokens",
  "users",
];

export async function resetDb(): Promise<void> {
  const sql = db();
  await sql.unsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
}
