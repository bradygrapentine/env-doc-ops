import { describe, it, expect, beforeEach } from "vitest";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  getCapturedEmails,
  clearCapturedEmails,
} from "./email";

beforeEach(() => {
  clearCapturedEmails();
});

describe("email sink", () => {
  it("sendVerificationEmail captures with right to + link substring", async () => {
    await sendVerificationEmail("alice@example.com", "https://app.example.com/verify?token=abc");
    const emails = getCapturedEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("alice@example.com");
    expect(emails[0].subject).toBe("Verify your EnvDocOS Traffic account");
    expect(emails[0].body).toContain("https://app.example.com/verify?token=abc");
    clearCapturedEmails();
    expect(getCapturedEmails()).toHaveLength(0);
  });

  it("sendPasswordResetEmail captures with right to + link substring", async () => {
    await sendPasswordResetEmail(
      "bob@example.com",
      "https://app.example.com/reset-password?token=xyz",
    );
    const emails = getCapturedEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("bob@example.com");
    expect(emails[0].subject).toBe("Reset your EnvDocOS Traffic password");
    expect(emails[0].body).toContain("/reset-password?token=xyz");
  });
});
