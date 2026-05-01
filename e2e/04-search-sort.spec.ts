import { test, expect } from "./fixtures";
import { createUserAndSignIn } from "./fixtures";
import { createProject } from "./helpers";

test("search filters and sort A→Z reorders project list", async ({ page }) => {
  await createUserAndSignIn(page, "sort");
  await createProject(page, { name: "Charlie Project" });
  await createProject(page, { name: "Alpha Project" });
  await createProject(page, { name: "Bravo Project" });

  await page.goto("/");
  // All three visible.
  await expect(page.getByText("Alpha Project")).toBeVisible();
  await expect(page.getByText("Bravo Project")).toBeVisible();
  await expect(page.getByText("Charlie Project")).toBeVisible();

  // Search for Alpha.
  await page.getByPlaceholder(/Search projects/).fill("Alpha");
  await expect(page.getByText("Alpha Project")).toBeVisible();
  await expect(page.getByText("Bravo Project")).toHaveCount(0);
  await expect(page.getByText("Charlie Project")).toHaveCount(0);

  // Clear and sort A→Z.
  await page.getByPlaceholder(/Search projects/).fill("");
  await page.getByLabel("Sort projects").selectOption({ label: "Name A→Z" });
  const items = page.locator("ul.divide-y > li");
  await expect(items.first()).toContainText("Alpha Project");
  await expect(items.nth(1)).toContainText("Bravo Project");
  await expect(items.nth(2)).toContainText("Charlie Project");
});
