import postgres from "postgres";

const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/envdocos";

// Each test process gets its own schema so vitest forks don't cross-contaminate.
const SCHEMA = `test_${process.pid}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

process.env.DATABASE_URL = url;
process.env.DATABASE_SCHEMA = SCHEMA;
process.env.EMAIL_SINK = "memory";

// jsdom-mode component tests mock @/lib/db; the dynamic ensureMigrated /
// closeDb imports below would resolve to the mock and throw. Detect dom-mode
// via the jsdom-only `window` global and skip the real Postgres setup there.
const isDom = typeof globalThis.window !== "undefined";

if (!isDom) {
  beforeAll(async () => {
    const admin = postgres(url, { max: 1 });
    await admin.unsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
    await admin.end({ timeout: 5 });

    const { ensureMigrated } = await import("@/lib/db");
    await ensureMigrated();
  });

  afterAll(async () => {
    const { closeDb } = await import("@/lib/db");
    await closeDb();
    const admin = postgres(url, { max: 1 });
    try {
      await admin.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
    } finally {
      await admin.end({ timeout: 5 });
    }
  });
}
