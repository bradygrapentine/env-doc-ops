import postgres from "postgres";

export default async function globalTeardown() {
  const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/envdocos";
  const schema = process.env.DATABASE_SCHEMA;
  if (!schema) return;
  const admin = postgres(url, { max: 1 });
  try {
    await admin.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}
