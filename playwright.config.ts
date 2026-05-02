import { defineConfig } from "@playwright/test";

const PORT = 3460;
const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5434/envdocos";
// Each E2E run gets its own Postgres schema so reruns don't see stale state.
// Set on process.env so global-setup / global-teardown see the same name.
const SCHEMA = `e2e_${process.pid}_${Date.now().toString(36)}`;
process.env.DATABASE_URL = DATABASE_URL;
process.env.DATABASE_SCHEMA = SCHEMA;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Middleware enforces same-origin on state-changing API calls.
    // Playwright APIRequestContext doesn't always send Origin, so set it.
    extraHTTPHeaders: { Origin: `http://localhost:${PORT}` },
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        headless: true,
      },
    },
  ],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  webServer: {
    command: `AUTH_SECRET=e2e-secret AUTH_TRUST_HOST=true EMAIL_SINK=memory RATE_LIMIT_DISABLED=1 DATABASE_URL='${DATABASE_URL}' DATABASE_SCHEMA=${SCHEMA} PORT=${PORT} npm run start`,
    port: PORT,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      DATABASE_URL,
      DATABASE_SCHEMA: SCHEMA,
    },
  },
});
