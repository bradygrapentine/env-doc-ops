import { test as base, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

export type TestUser = {
  email: string;
  password: string;
  name: string;
};

export function makeUser(prefix = "user"): TestUser {
  const id = randomUUID().slice(0, 8);
  return {
    email: `${prefix}-${id}@example.com`,
    password: "TestPassword123!",
    name: `${prefix} ${id}`,
  };
}

export async function signUpUser(page: Page, user: TestUser): Promise<void> {
  const res = await page.request.post("/api/auth/signup", {
    data: { email: user.email, password: user.password, name: user.name },
  });
  expect(res.ok(), `signup failed: ${res.status()} ${await res.text()}`).toBeTruthy();
}

export async function signIn(page: Page, user: TestUser): Promise<void> {
  await page.goto("/signin");
  await page.locator('input[name="email"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/" || url.pathname.startsWith("/projects"), {
      timeout: 15_000,
    }),
    page.getByRole("button", { name: /^Sign(ing)? in/ }).click(),
  ]);
}

export async function signOut(page: Page): Promise<void> {
  // The sign-out button is a small button in the layout. Use the API directly via a form post.
  // Cleanest: hit /api/auth/signout via next-auth; clear cookies as a backup.
  await page.context().clearCookies();
}

export async function createUserAndSignIn(page: Page, prefix = "user"): Promise<TestUser> {
  const user = makeUser(prefix);
  await signUpUser(page, user);
  await signIn(page, user);
  return user;
}

type Fixtures = {
  user: TestUser;
};

export const signedInTest = base.extend<Fixtures>({
  user: async ({ page }, use) => {
    const user = await createUserAndSignIn(page);
    await use(user);
  },
});

export { expect } from "@playwright/test";
export const test = base;
