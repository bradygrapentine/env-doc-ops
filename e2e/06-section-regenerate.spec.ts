import { test, expect } from "./fixtures";
import { createUserAndSignIn } from "./fixtures";
import { createProject, uploadAndImportCsv, generateReport } from "./helpers";

test("section-level regenerate resets edited content to template", async ({ page }) => {
  await createUserAndSignIn(page, "secregen");
  await createProject(page, { name: "Section Regenerate" });
  await uploadAndImportCsv(page);
  await generateReport(page);

  const textarea = page.locator("textarea").first();
  await expect(textarea).toBeVisible();
  const original = await textarea.inputValue();
  const edited = original + "\n\n[E2E SECTION REGEN MARKER]";
  await textarea.fill(edited);
  await page.getByRole("button", { name: /Save section/ }).click();
  await expect(page.getByText("Saving…")).toHaveCount(0, { timeout: 10_000 });

  // Auto-accept the confirm() dialog.
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /Regenerate from data/ }).click();
  await expect(page.getByText("Regenerating…")).toHaveCount(0, { timeout: 10_000 });

  // Marker should be gone; content reset.
  const after = await page.locator("textarea").first().inputValue();
  expect(after).not.toContain("[E2E SECTION REGEN MARKER]");
});
