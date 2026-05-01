import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/session", () => ({ getSessionUserId: vi.fn() }));
vi.mock("@/lib/db", () => ({ userRepo: { findById: vi.fn() } }));

import { getSessionUserId } from "@/lib/session";
import { userRepo } from "@/lib/db";
import AccountPage from "./page";

describe("AccountPage", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("redirects when no session", async () => {
    (getSessionUserId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(AccountPage({})).rejects.toThrow(/NEXT_REDIRECT:\/signin/);
  });

  it("redirects when user not found", async () => {
    (getSessionUserId as ReturnType<typeof vi.fn>).mockResolvedValueOnce("u1");
    (userRepo.findById as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);
    await expect(AccountPage({})).rejects.toThrow(/NEXT_REDIRECT:\/signin/);
  });

  it("renders user fields when authenticated", async () => {
    (getSessionUserId as ReturnType<typeof vi.fn>).mockResolvedValueOnce("u1");
    (userRepo.findById as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      id: "u1",
      email: "u@x.com",
      name: "Brady",
      emailVerifiedAt: null,
    });
    const tree = await AccountPage({});
    const s = JSON.stringify(tree);
    expect(s).toContain("Brady");
    expect(s).toContain("u@x.com");
  });
});
