import crypto from "node:crypto";
import { db } from "./db";

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

async function consume(
  table: "verification_tokens" | "password_reset_tokens",
  token: string,
): Promise<ConsumeResult> {
  const sql = db();
  const tableId = sql(table);
  const rows =
    (await sql`SELECT token, "userId", "expiresAt", "usedAt" FROM ${tableId} WHERE token = ${token}`) as unknown as TokenRow[];
  const row = rows[0];
  if (!row) return { error: "invalid" };
  if (row.usedAt) return { error: "used" };
  if (Date.parse(row.expiresAt) < Date.now()) return { error: "expired" };
  const ts = nowIso();
  const result = await sql`
    UPDATE ${tableId} SET "usedAt" = ${ts} WHERE token = ${token} AND "usedAt" IS NULL
  `;
  if (result.count === 0) return { error: "used" };
  return { userId: row.userId };
}

export const tokenRepo = {
  async createVerification(userId: string): Promise<{ token: string; expiresAt: string }> {
    const sql = db();
    const token = newToken();
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_MS).toISOString();
    await sql`
      INSERT INTO verification_tokens (token, "userId", "expiresAt", "usedAt")
      VALUES (${token}, ${userId}, ${expiresAt}, NULL)
    `;
    return { token, expiresAt };
  },
  async createReset(userId: string): Promise<{ token: string; expiresAt: string }> {
    const sql = db();
    const token = newToken();
    const expiresAt = new Date(Date.now() + RESET_TTL_MS).toISOString();
    await sql`
      INSERT INTO password_reset_tokens (token, "userId", "expiresAt", "usedAt")
      VALUES (${token}, ${userId}, ${expiresAt}, NULL)
    `;
    return { token, expiresAt };
  },
  consumeVerification(token: string): Promise<ConsumeResult> {
    return consume("verification_tokens", token);
  },
  consumeReset(token: string): Promise<ConsumeResult> {
    return consume("password_reset_tokens", token);
  },
  async createEmailChange(
    userId: string,
    newEmail: string,
  ): Promise<{ token: string; expiresAt: string }> {
    const sql = db();
    const token = newToken();
    const expiresAt = new Date(Date.now() + EMAIL_CHANGE_TTL_MS).toISOString();
    await sql`
      INSERT INTO email_change_tokens (token, "userId", "newEmail", "expiresAt", "usedAt")
      VALUES (${token}, ${userId}, ${newEmail}, ${expiresAt}, NULL)
    `;
    return { token, expiresAt };
  },
  // Non-consuming peek used by the confirmation page so it can show the
  // pending new email before the user clicks Confirm. Mail-client / corp URL
  // prefetchers fetch the page on link-arrival; consumption only via
  // consumeEmailChange below.
  async peekEmailChange(
    token: string,
  ): Promise<{ userId: string; newEmail: string } | { error: "invalid" | "expired" | "used" }> {
    const sql = db();
    const rows = (await sql`
      SELECT token, "userId", "newEmail", "expiresAt", "usedAt"
      FROM email_change_tokens WHERE token = ${token}
    `) as unknown as Array<{
      token: string;
      userId: string;
      newEmail: string;
      expiresAt: string;
      usedAt: string | null;
    }>;
    const row = rows[0];
    if (!row) return { error: "invalid" };
    if (row.usedAt) return { error: "used" };
    if (Date.parse(row.expiresAt) < Date.now()) return { error: "expired" };
    return { userId: row.userId, newEmail: row.newEmail };
  },
  async consumeEmailChange(
    token: string,
  ): Promise<{ userId: string; newEmail: string } | { error: "invalid" | "expired" | "used" }> {
    const sql = db();
    const rows = (await sql`
      SELECT token, "userId", "newEmail", "expiresAt", "usedAt"
      FROM email_change_tokens WHERE token = ${token}
    `) as unknown as Array<{
      token: string;
      userId: string;
      newEmail: string;
      expiresAt: string;
      usedAt: string | null;
    }>;
    const row = rows[0];
    if (!row) return { error: "invalid" };
    if (row.usedAt) return { error: "used" };
    if (Date.parse(row.expiresAt) < Date.now()) return { error: "expired" };
    const ts = nowIso();
    const result = await sql`
      UPDATE email_change_tokens SET "usedAt" = ${ts}
      WHERE token = ${token} AND "usedAt" IS NULL
    `;
    if (result.count === 0) return { error: "used" };
    return { userId: row.userId, newEmail: row.newEmail };
  },
};
