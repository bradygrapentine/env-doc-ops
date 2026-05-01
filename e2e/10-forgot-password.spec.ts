import { test, expect } from "./fixtures";
import { signUpUser, signIn, makeUser } from "./fixtures";

type CapturedEmail = { to: string; subject: string; body: string; link: string };

test("forgot password: request reset, follow email link, set new password, sign in", async ({
  page,
}) => {
  const user = makeUser("forgot");
  await signUpUser(page, user);

  await page.goto("/forgot-password");
  await page.locator('input[name="email"]').fill(user.email);
  await page.getByRole("button", { name: /Send reset link/ }).click();
  await expect(page.getByText(/we've sent a reset link|reset link/i)).toBeVisible({
    timeout: 10_000,
  });

  // Fetch captured emails.
  const res = await page.request.get("/api/test-only/emails");
  expect(res.ok(), `emails endpoint should be 200, got ${res.status()}`).toBeTruthy();
  const emails = (await res.json()) as CapturedEmail[];
  const reset = [...emails].reverse().find((e) => e.to === user.email && e.subject.match(/Reset/));
  expect(reset, `expected reset email for ${user.email}`).toBeTruthy();
  expect(reset!.link).toMatch(/\/reset-password\?token=/);

  // Follow link and set new password.
  await page.goto(reset!.link);
  const newPassword = "ResetPass789!";
  await page.locator('input[name="newPassword"]').fill(newPassword);
  await page.locator('input[name="confirmPassword"]').fill(newPassword);
  await page.getByRole("button", { name: /Reset password/ }).click();
  await expect(page.getByRole("heading", { name: /Password reset/i })).toBeVisible({
    timeout: 10_000,
  });

  // Sign in with new password.
  await signIn(page, { ...user, password: newPassword });
  await expect(page).toHaveURL(/\/$/);
});
