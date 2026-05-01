import { test, expect } from "./fixtures";
import { createUserAndSignIn } from "./fixtures";
import { createProject, uploadAndImportCsv, generateReport } from "./helpers";

test("project lifecycle: create, upload CSV, generate report, edit section, save, export DOCX", async ({
  page,
}) => {
  await createUserAndSignIn(page, "lifecycle");
  await createProject(page, { name: "Lifecycle Project" });
  await uploadAndImportCsv(page);
  await generateReport(page);

  // Should be on /reports/:id
  await expect(page.getByRole("heading", { name: "Report" })).toBeVisible();

  // Edit the active section (default first one, e.g. Executive Summary).
  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible();
  const original = await textarea.inputValue();
  const edited = original + "\n\n[E2E EDIT MARKER]";
  await textarea.fill(edited);
  // Trigger save by blurring — actually save happens via fetch on... let's look. The editor exposes a Save button.
  // From ReportEditor.tsx: there's no explicit Save button visible — saveSection is called from a handler.
  // Use the Save button (it exists, look for "Save").
  await page.getByRole("button", { name: /Save section/ }).click();
  // Wait for "Saving…" indicator to disappear.
  await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 10_000 });
  await page.reload();
  const reloadedTextarea = page.locator("textarea").first();
  await expect(reloadedTextarea).toHaveValue(edited);

  // Export DOCX — listen for download.
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: /Export DOCX/ }).click(),
  ]);
  const dlPath = await download.path();
  expect(dlPath, "DOCX download has no path").toBeTruthy();
  // DOCX is a ZIP — first 2 bytes are "PK".
  const fs = await import("node:fs/promises");
  const buf = await fs.readFile(dlPath!);
  expect(buf.slice(0, 2).toString("utf8")).toBe("PK");
});
