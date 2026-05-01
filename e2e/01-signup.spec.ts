import { test, expect, makeUser, signUpUser, signIn } from "./fixtures";

test("fresh signup lands on / and shows + New Project", async ({ page }) => {
  const user = makeUser("signup");
  await signUpUser(page, user);
  await signIn(page, user);
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", { name: /\+ New Project/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});
