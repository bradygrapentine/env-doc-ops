import postgres from "postgres";

export default async function globalSetup() {
  const url = process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/envdocos";
  const schema = process.env.DATABASE_SCHEMA;
  if (!schema) throw new Error("DATABASE_SCHEMA must be set for E2E (see playwright.config.ts).");
  const admin = postgres(url, { max: 1 });
  try {
    await admin.unsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
}
