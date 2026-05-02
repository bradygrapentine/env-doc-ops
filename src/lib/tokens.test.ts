import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { resetDb } from "../../test/db";
import { tokenRepo } from "./tokens";
import { userRepo, _dbInternal } from "./db";

let userId: string;

beforeEach(async () => {
  await resetDb();
  const u = await userRepo.create({
    email: "tok@example.com",
    name: "Tok",
    passwordHash: bcrypt.hashSync("password123", 4),
  });
  userId = u.id;
});

describe("tokenRepo.createReset / consumeReset", () => {
  it("createReset then consumeReset returns userId", async () => {
    const { token } = await tokenRepo.createReset(userId);
    const result = await tokenRepo.consumeReset(token);
    expect(result).toEqual({ userId });
  });

  it("consumeReset on a freshly-consumed token returns used", async () => {
    const { token } = await tokenRepo.createReset(userId);
    await tokenRepo.consumeReset(token);
    const second = await tokenRepo.consumeReset(token);
    expect(second).toEqual({ error: "used" });
  });

  it("consumeReset on an expired token returns expired", async () => {
    // Insert a row with a past expiresAt directly.
    const past = new Date(Date.now() - 1000).toISOString();
    const token = "expired-reset-token";
    const sql = _dbInternal();
    await sql`
      INSERT INTO password_reset_tokens (token, "userId", "expiresAt", "usedAt")
      VALUES (${token}, ${userId}, ${past}, NULL)
    `;
    const result = await tokenRepo.consumeReset(token);
    expect(result).toEqual({ error: "expired" });
  });

  it("consumeReset on garbage returns invalid", async () => {
    expect(await tokenRepo.consumeReset("garbage")).toEqual({ error: "invalid" });
  });
});

describe("tokenRepo.createVerification / consumeVerification", () => {
  it("createVerification then consumeVerification returns userId", async () => {
    const { token } = await tokenRepo.createVerification(userId);
    const result = await tokenRepo.consumeVerification(token);
    expect(result).toEqual({ userId });
  });

  it("consumeVerification on a freshly-consumed token returns used", async () => {
    const { token } = await tokenRepo.createVerification(userId);
    await tokenRepo.consumeVerification(token);
    const second = await tokenRepo.consumeVerification(token);
    expect(second).toEqual({ error: "used" });
  });

  it("consumeVerification on an expired token returns expired", async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const token = "expired-verify-token";
    const sql = _dbInternal();
    await sql`
      INSERT INTO verification_tokens (token, "userId", "expiresAt", "usedAt")
      VALUES (${token}, ${userId}, ${past}, NULL)
    `;
    const result = await tokenRepo.consumeVerification(token);
    expect(result).toEqual({ error: "expired" });
  });

  it("consumeVerification on garbage returns invalid", async () => {
    expect(await tokenRepo.consumeVerification("garbage")).toEqual({ error: "invalid" });
  });
});
