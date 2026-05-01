import { test, expect } from "./fixtures";
import { signUpUser, signIn, makeUser } from "./fixtures";
import { createProject } from "./helpers";

test("user B cannot see user A's projects and gets 404 on direct URL", async ({ browser }) => {
  // User A: create project.
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  const userA = makeUser("a");
  await signUpUser(pageA, userA);
  await signIn(pageA, userA);
  const projectId = await createProject(pageA, { name: "Private Project A" });
  await ctxA.close();

  // User B: separate context.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  const userB = makeUser("b");
  await signUpUser(pageB, userB);
  await signIn(pageB, userB);

  // B's project list does not show A's project.
  await pageB.goto("/");
  await expect(pageB.getByText("Private Project A")).toHaveCount(0);

  // Direct URL → renders 404 page (project not found).
  await pageB.goto(`/projects/${projectId}`);
  await expect(pageB.getByRole("heading", { name: /Project not found/i })).toBeVisible();
  await ctxB.close();
});
