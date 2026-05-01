import { describe, it, expect, beforeEach } from "vitest";
import { consume, resetSucceeded, _resetForTest } from "./rate-limit";

beforeEach(() => {
  _resetForTest();
});

describe("rate-limit consume()", () => {
  it("allows the first call and reports remaining", () => {
    const r = consume("u1", "change-password", { max: 3, windowMs: 1000 });
    expect(r).toEqual({ ok: true });
  });

  it("blocks once max attempts are reached in the window", () => {
    consume("u1", "change-password", { max: 2, windowMs: 1000 });
    consume("u1", "change-password", { max: 2, windowMs: 1000 });
    const third = consume("u1", "change-password", { max: 2, windowMs: 1000 });
    expect(third.ok).toBe(false);
    if (!third.ok) expect(third.retryAfterMs).toBeGreaterThan(0);
  });

  it("isolates buckets by (userId, action)", () => {
    consume("u1", "change-password", { max: 1, windowMs: 1000 });
    expect(consume("u2", "change-password", { max: 1, windowMs: 1000 }).ok).toBe(true);
    expect(consume("u1", "change-email", { max: 1, windowMs: 1000 }).ok).toBe(true);
    expect(consume("u1", "change-password", { max: 1, windowMs: 1000 }).ok).toBe(false);
  });

  it("resets the bucket after the window elapses", () => {
    const now = 10_000;
    const r1 = consume("u1", "change-password", { max: 1, windowMs: 1000 }, now);
    expect(r1.ok).toBe(true);
    const r2 = consume("u1", "change-password", { max: 1, windowMs: 1000 }, now + 500);
    expect(r2.ok).toBe(false);
    const r3 = consume("u1", "change-password", { max: 1, windowMs: 1000 }, now + 1500);
    expect(r3.ok).toBe(true);
  });

  it("retryAfterMs reflects remaining window", () => {
    const now = 10_000;
    consume("u1", "change-password", { max: 1, windowMs: 1000 }, now);
    const blocked = consume("u1", "change-password", { max: 1, windowMs: 1000 }, now + 200);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterMs).toBe(800);
  });

  it("resetSucceeded clears the bucket so the user isn't locked out after a typo", () => {
    consume("u1", "change-password", { max: 2, windowMs: 1000 });
    consume("u1", "change-password", { max: 2, windowMs: 1000 });
    resetSucceeded("u1", "change-password");
    const r = consume("u1", "change-password", { max: 2, windowMs: 1000 });
    expect(r.ok).toBe(true);
  });
});
