import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/session", () => ({
  getSessionUserId: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  projectRepo: { listAccessible: vi.fn(() => []) },
}));

import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/session";
import { projectRepo } from "@/lib/db";
import ProjectsPage from "./page";

describe("ProjectsPage (server component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to /signin when unauthenticated", async () => {
    (getSessionUserId as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(ProjectsPage()).rejects.toThrow(/NEXT_REDIRECT:\/signin/);
    expect(redirect).toHaveBeenCalledWith("/signin");
  });

  it("renders project list when authenticated", async () => {
    (getSessionUserId as ReturnType<typeof vi.fn>).mockResolvedValueOnce("u1");
    (projectRepo.listAccessible as ReturnType<typeof vi.fn>).mockReturnValueOnce([
      {
        id: "p1",
        name: "Demo",
        location: "Boston",
        jurisdiction: "MA",
        createdAt: "2024-01-01T00:00:00Z",
        role: "owner",
      },
    ]);
    const tree = await ProjectsPage();
    expect(tree).toBeDefined();
    // Element tree should contain a heading "Projects"
    const stringified = JSON.stringify(tree);
    expect(stringified).toContain("Projects");
  });
});
