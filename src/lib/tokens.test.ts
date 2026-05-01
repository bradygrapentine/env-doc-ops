import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { resetDb } from "../../test/db";
import { tokenRepo } from "./tokens";
import { userRepo, _dbInternal } from "./db";

let userId: string;

beforeEach(() => {
  resetDb();
  const u = userRepo.create({
    email: "tok@example.com",
    name: "Tok",
    passwordHash: bcrypt.hashSync("password123", 4),
  });
  userId = u.id;
});

describe("tokenRepo.createReset / consumeReset", () => {
  it("createReset then consumeReset returns userId", () => {
    const { token } = tokenRepo.createReset(userId);
    const result = tokenRepo.consumeReset(token);
    expect(result).toEqual({ userId });
  });

  it("consumeReset on a freshly-consumed token returns used", () => {
    const { token } = tokenRepo.createReset(userId);
    tokenRepo.consumeReset(token);
    const second = tokenRepo.consumeReset(token);
    expect(second).toEqual({ error: "used" });
  });

  it("consumeReset on an expired token returns expired", () => {
    // Insert a row with a past expiresAt directly.
    const past = new Date(Date.now() - 1000).toISOString();
    const token = "expired-reset-token";
    _dbInternal()
      .prepare(
        "INSERT INTO password_reset_tokens (token, userId, expiresAt, usedAt) VALUES (?, ?, ?, NULL)",
      )
      .run(token, userId, past);
    const result = tokenRepo.consumeReset(token);
    expect(result).toEqual({ error: "expired" });
  });

  it("consumeReset on garbage returns invalid", () => {
    expect(tokenRepo.consumeReset("garbage")).toEqual({ error: "invalid" });
  });
});

describe("tokenRepo.createVerification / consumeVerification", () => {
  it("createVerification then consumeVerification returns userId", () => {
    const { token } = tokenRepo.createVerification(userId);
    const result = tokenRepo.consumeVerification(token);
    expect(result).toEqual({ userId });
  });

  it("consumeVerification on a freshly-consumed token returns used", () => {
    const { token } = tokenRepo.createVerification(userId);
    tokenRepo.consumeVerification(token);
    const second = tokenRepo.consumeVerification(token);
    expect(second).toEqual({ error: "used" });
  });

  it("consumeVerification on an expired token returns expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const token = "expired-verify-token";
    _dbInternal()
      .prepare(
        "INSERT INTO verification_tokens (token, userId, expiresAt, usedAt) VALUES (?, ?, ?, NULL)",
      )
      .run(token, userId, past);
    const result = tokenRepo.consumeVerification(token);
    expect(result).toEqual({ error: "expired" });
  });

  it("consumeVerification on garbage returns invalid", () => {
    expect(tokenRepo.consumeVerification("garbage")).toEqual({ error: "invalid" });
  });
});
