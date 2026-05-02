// Run pending Postgres migrations. Invoked before `next start` (see package.json
// `prestart` and the Playwright webServer command). Idempotent — already-applied
// migrations are skipped via the schema_migrations table.
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set; skipping migrations.");
  process.exit(0);
}

const schema = process.env.DATABASE_SCHEMA;
const sql = postgres(url, {
  max: 1,
  connection: schema ? { search_path: `"${schema}", public` } : undefined,
  onnotice: () => {},
});

const dir = path.join(process.cwd(), "src", "lib", "migrations");

try {
  if (schema) {
    await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  }
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      "appliedAt" TEXT NOT NULL
    )
  `);
  const applied = new Set(
    (await sql`SELECT filename FROM schema_migrations`).map((r) => r.filename),
  );
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    const body = fs.readFileSync(path.join(dir, f), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (filename, "appliedAt") VALUES (${f}, ${new Date().toISOString()})`;
    });
    console.log(`applied: ${f}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}
