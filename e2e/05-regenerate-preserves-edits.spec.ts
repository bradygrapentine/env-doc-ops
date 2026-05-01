import { test, expect } from "./fixtures";
import { createUserAndSignIn } from "./fixtures";
import { createProject, uploadAndImportCsv, generateReport } from "./helpers";

test("regenerate preserves user-edited sections; banner shows preserved count", async ({
  page,
}) => {
  await createUserAndSignIn(page, "preserve");
  const projectId = await createProject(page, { name: "Preserve Test" });
  await uploadAndImportCsv(page);
  await generateReport(page);

  // Click Executive Summary in the sidebar (it's typically section 1).
  // Edit the active section.
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible();
  const marker = "[E2E PRESERVED MARKER]";
  await textarea.fill((await textarea.inputValue()) + "\n\n" + marker);
  const [saveResp] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/sections/") && r.request().method() === "PATCH",
      { timeout: 15_000 },
    ),
    page.getByRole("button", { name: /Save section/ }).click(),
  ]);
  expect(saveResp.ok(), `section save failed: ${saveResp.status()}`).toBeTruthy();

  // Now navigate back to project and regenerate.
  await page.goto(`/projects/${projectId}`);
  await page.getByRole("button", { name: /Generate Report/ }).click();

  // Confirmation should appear with "Refresh" button because we have preserved sections.
  const refreshBtn = page.getByRole("button", { name: /^Refresh$/ });
  await expect(refreshBtn).toBeVisible({ timeout: 10_000 });
  await refreshBtn.click();
  await page.waitForURL(/\/reports\/[^/?]+/, { timeout: 15_000 });

  // Banner shows preserved count >= 1.
  await expect(page.getByText(/preserved \(user-edited\)/i)).toBeVisible();

  // Edit retained.
  const reloadedTextarea = page.locator("textarea").first();
  await expect(reloadedTextarea).toContainText(marker);
});
