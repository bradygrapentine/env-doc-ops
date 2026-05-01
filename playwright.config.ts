import { defineConfig } from "@playwright/test";

const PORT = 3460;
const DB_PATH = `/tmp/e2e-${process.pid}-${Date.now()}.db`;

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
  webServer: {
    command: `AUTH_SECRET=e2e-secret AUTH_TRUST_HOST=true EMAIL_SINK=memory RATE_LIMIT_DISABLED=1 ENVDOCOS_DB_PATH=${DB_PATH} PORT=${PORT} npm run start`,
    port: PORT,
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
