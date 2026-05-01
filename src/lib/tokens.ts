import crypto from "node:crypto";
import { _dbInternal } from "./db";

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_TTL_MS = 60 * 60 * 1000; // 1h
const EMAIL_CHANGE_TTL_MS = 60 * 60 * 1000; // 1h

function newToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function nowIso(): string {
  return new Date().toISOString();
}

type TokenRow = {
  token: string;
  userId: string;
  expiresAt: string;
  usedAt: string | null;
};

type ConsumeResult = { userId: string } | { error: "invalid" | "expired" | "used" };

function consume(
  table: "verification_tokens" | "password_reset_tokens",
  token: string,
): ConsumeResult {
  const conn = _dbInternal();
  const row = conn.prepare(`SELECT * FROM ${table} WHERE token = ?`).get(token) as
    | TokenRow
    | undefined;
  if (!row) return { error: "invalid" };
  if (row.usedAt) return { error: "used" };
  if (Date.parse(row.expiresAt) < Date.now()) return { error: "expired" };
  const ts = nowIso();
  // Atomic update — only mark used if still unused.
  const info = conn
    .prepare(`UPDATE ${table} SET usedAt = ? WHERE token = ? AND usedAt IS NULL`)
    .run(ts, token);
  if (info.changes === 0) return { error: "used" };
  return { userId: row.userId };
}

export const tokenRepo = {
  createVerification(userId: string): { token: string; expiresAt: string } {
    const conn = _dbInternal();
    const token = newToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    conn
      .prepare(
        "INSERT INTO verification_tokens (token, userId, expiresAt, usedAt) VALUES (?, ?, ?, NULL)",
      )
      .run(token, userId, expiresAt);
    return { token, expiresAt };
  },
  createReset(userId: string): { token: string; expiresAt: string } {
    const conn = _dbInternal();
    const token = newToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
    conn
      .prepare(
        "INSERT INTO password_reset_tokens (token, userId, expiresAt, usedAt) VALUES (?, ?, ?, NULL)",
      )
      .run(token, userId, expiresAt);
    return { token, expiresAt };
  },
  consumeVerification(token: string): ConsumeResult {
    return consume("verification_tokens", token);
  },
  consumeReset(token: string): ConsumeResult {
    return consume("password_reset_tokens", token);
  },
  createEmailChange(userId: string, newEmail: string): { token: string; expiresAt: string } {
    const conn = _dbInternal();
    const token = newToken();
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS).toISOString();
    conn
      .prepare(
        "INSERT INTO email_change_tokens (token, userId, newEmail, expiresAt, usedAt) VALUES (?, ?, ?, ?, NULL)",
      )
      .run(token, userId, newEmail, expiresAt);
    return { token, expiresAt };
  },
  // Non-consuming peek used by the confirmation page so it can show the
  // pending new email before the user clicks Confirm. Mail-client / corp URL
  // prefetchers fetch the page on link-arrival; consumption only happens via
  // consumeEmailChange below.
  peekEmailChange(
    token: string,
  ): { userId: string; newEmail: string } | { error: "invalid" | "expired" | "used" } {
    const conn = _dbInternal();
    const row = conn.prepare("SELECT * FROM email_change_tokens WHERE token = ?").get(token) as
      | {
          token: string;
          userId: string;
          newEmail: string;
          expiresAt: string;
          usedAt: string | null;
        }
      | undefined;
    if (!row) return { error: "invalid" };
    if (row.usedAt) return { error: "used" };
    if (Date.parse(row.expiresAt) < Date.now()) return { error: "expired" };
    return { userId: row.userId, newEmail: row.newEmail };
  },
  consumeEmailChange(
    token: string,
  ): { userId: string; newEmail: string } | { error: "invalid" | "expired" | "used" } {
    const conn = _dbInternal();
    const row = conn.prepare("SELECT * FROM email_change_tokens WHERE token = ?").get(token) as
      | {
          token: string;
          userId: string;
          newEmail: string;
          expiresAt: string;
          usedAt: string | null;
        }
      | undefined;
    if (!row) return { error: "invalid" };
    if (row.usedAt) return { error: "used" };
    if (Date.parse(row.expiresAt) < Date.now()) return { error: "expired" };
    const ts = nowIso();
    const info = conn
      .prepare("UPDATE email_change_tokens SET usedAt = ? WHERE token = ? AND usedAt IS NULL")
      .run(ts, token);
    if (info.changes === 0) return { error: "used" };
    return { userId: row.userId, newEmail: row.newEmail };
  },
};
