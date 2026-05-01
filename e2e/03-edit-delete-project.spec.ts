import { test, expect } from "./fixtures";
import { createUserAndSignIn } from "./fixtures";
import { createProject } from "./helpers";

test("edit project fields persist after reload, then delete with confirm modal", async ({
  page,
}) => {
  await createUserAndSignIn(page, "editdel");
  const id = await createProject(page, { name: "Original Name" });

  await page.goto(`/projects/${id}/edit`);
  await page.locator('input[name="name"]').waitFor({ timeout: 10_000 });
  await page.locator('input[name="name"]').fill("Renamed Project");
  await page.locator('input[name="location"]').fill("New Location, NY");
  await Promise.all([
    page.waitForURL(`**/projects/${id}`),
    page.getByRole("button", { name: /Save Changes/ }).click(),
  ]);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Renamed Project" })).toBeVisible();
  await expect(page.getByText(/New Location, NY/)).toBeVisible();

  // Delete via confirm modal.
  await page.getByRole("button", { name: /^Delete$/ }).click();
  await expect(page.getByText(/Delete project\?/)).toBeVisible();
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/" || url.pathname === ""),
    page
      .getByRole("button", { name: /^Delete$/ })
      .last()
      .click(),
  ]);
  await expect(page.getByText("Renamed Project")).toHaveCount(0);
});
