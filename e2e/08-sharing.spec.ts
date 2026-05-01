import { test, expect } from "./fixtures";
import { signUpUser, signIn, makeUser } from "./fixtures";
import { createProject } from "./helpers";

test("owner shares project; sharee gets read-only badge and PATCH returns 403", async ({
  browser,
}) => {
  // Owner.
  const ownerCtx = await browser.newContext();
  const ownerPage = await ownerCtx.newPage();
  const owner = makeUser("owner");
  await signUpUser(ownerPage, owner);
  await signIn(ownerPage, owner);
  const projectId = await createProject(ownerPage, { name: "Shared Project" });

  // Pre-create sharee account.
  const sharee = makeUser("sharee");
  await signUpUser(ownerPage, sharee);

  // Owner shares with sharee email.
  await ownerPage.goto(`/projects/${projectId}`);
  await ownerPage.locator("#invite-email").fill(sharee.email);
  await ownerPage.getByRole("button", { name: "Invite", exact: true }).click();
  await expect(ownerPage.getByText(sharee.email)).toBeVisible({ timeout: 10_000 });
  await ownerCtx.close();

  // Sharee context.
  const shareeCtx = await browser.newContext();
  const shareePage = await shareeCtx.newPage();
  await signIn(shareePage, sharee);

  // Sharee sees the project on the home list with a Shared badge.
  await shareePage.goto("/");
  await expect(shareePage.getByText("Shared Project")).toBeVisible();
  await expect(shareePage.getByText(/Shared/i).first()).toBeVisible();

  // Sharee project page hides Edit/Delete.
  await shareePage.goto(`/projects/${projectId}`);
  await expect(shareePage.getByRole("link", { name: "Edit" })).toHaveCount(0);
  await expect(shareePage.getByRole("button", { name: /^Delete$/ })).toHaveCount(0);
  await expect(shareePage.getByText(/Shared with you/i)).toBeVisible();

  // PATCH directly returns 403.
  const patchRes = await shareePage.request.patch(`/api/projects/${projectId}`, {
    data: { name: "Hijacked" },
  });
  expect(patchRes.status()).toBe(403);
  await shareeCtx.close();
});
