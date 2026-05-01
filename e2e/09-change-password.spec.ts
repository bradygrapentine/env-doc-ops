import { test, expect } from "./fixtures";
import { createUserAndSignIn, signIn } from "./fixtures";

test("change password via /account, sign out, sign in with new password", async ({ page }) => {
  const user = await createUserAndSignIn(page, "chgpw");
  const newPassword = "NewPassword456!";

  await page.goto("/account");
  await page.locator('input[name="currentPassword"]').fill(user.password);
  await page.locator('input[name="newPassword"]').fill(newPassword);
  await page.locator('input[name="confirmPassword"]').fill(newPassword);
  await page.getByRole("button", { name: /Update password/ }).click();
  await expect(page.getByText("Password updated.")).toBeVisible({ timeout: 10_000 });

  // Clear cookies (sign out) and sign in with new password.
  await page.context().clearCookies();
  await signIn(page, { ...user, password: newPassword });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Projects" })).toBeVisible();
});
