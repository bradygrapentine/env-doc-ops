import path from "node:path";
import { expect, type Page } from "@playwright/test";

export const SAMPLE_CSV = path.resolve(__dirname, "../sample_data/sample_traffic_counts.csv");

export async function createProject(
  page: Page,
  fields: {
    name: string;
    location?: string;
    jurisdiction?: string;
    clientName?: string;
    projectType?: string;
    developmentSummary?: string;
    preparedBy?: string;
  },
): Promise<string> {
  await page.goto("/projects/new");
  await page.locator('input[name="name"]').fill(fields.name);
  await page.locator('input[name="location"]').fill(fields.location ?? "Anytown, CA");
  await page.locator('input[name="jurisdiction"]').fill(fields.jurisdiction ?? "City of Anytown");
  if (fields.clientName) await page.locator('input[name="clientName"]').fill(fields.clientName);
  await page
    .locator('input[name="projectType"]')
    .fill(fields.projectType ?? "Mixed-use development");
  await page
    .locator('textarea[name="developmentSummary"]')
    .fill(fields.developmentSummary ?? "120 residential units and 15,000 sq ft of retail");
  if (fields.preparedBy) await page.locator('input[name="preparedBy"]').fill(fields.preparedBy);
  await Promise.all([
    page.waitForURL((url) => /\/projects\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith("/new"), {
      timeout: 15_000,
    }),
    page.getByRole("button", { name: /Create Project/ }).click(),
  ]);
  const m = page.url().match(/\/projects\/([^/]+)$/);
  expect(m, `expected to land on project page, got ${page.url()}`).toBeTruthy();
  return m![1];
}

export async function uploadAndImportCsv(page: Page, csvPath: string = SAMPLE_CSV): Promise<void> {
  // Set the file in the hidden file input.
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(csvPath);
  await page.getByRole("button", { name: /^Preview/ }).click();
  // Wait for confirm import button to appear; assume sample CSV has no invalid rows.
  const confirmBtn = page.getByRole("button", { name: /Confirm import/ });
  await expect(confirmBtn).toBeEnabled({ timeout: 10_000 });
  await confirmBtn.click();
  await expect(page.getByText(/rows imported/)).toBeVisible({ timeout: 10_000 });
}

export async function generateReport(page: Page): Promise<string> {
  // Click "Generate Report" — may show a confirmation dialog if there are preserved sections,
  // otherwise navigates straight to /reports/:id.
  const generateBtn = page.getByRole("button", { name: /Generate Report/ });
  await generateBtn.click();
  // If "Refresh" button appears (preserved sections), click it.
  const refreshBtn = page.getByRole("button", { name: /^Refresh$/ });
  await Promise.race([
    page.waitForURL(/\/reports\/[^/?]+/, { timeout: 15_000 }),
    refreshBtn.waitFor({ timeout: 5_000 }).then(() => refreshBtn.click()),
  ]);
  await page.waitForURL(/\/reports\/[^/?]+/, { timeout: 15_000 });
  const m = page.url().match(/\/reports\/([^/?]+)/);
  return m![1];
}
