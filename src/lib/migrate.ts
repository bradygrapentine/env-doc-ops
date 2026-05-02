import fs from "node:fs";
import path from "node:path";
import type { Sql } from "postgres";

const MIGRATIONS_DIR = path.join(process.cwd(), "src", "lib", "migrations");

export async function runMigrations(sql: Sql): Promise<void> {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      "appliedAt" TEXT NOT NULL
    )
  `);

  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const applied = new Set(
    (await sql<{ filename: string }[]>`SELECT filename FROM schema_migrations`).map(
      (r) => r.filename,
    ),
  );

  for (const filename of files) {
    if (applied.has(filename)) continue;
    const body = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`INSERT INTO schema_migrations (filename, "appliedAt") VALUES (${filename}, ${new Date().toISOString()})`;
    });
  }
}
