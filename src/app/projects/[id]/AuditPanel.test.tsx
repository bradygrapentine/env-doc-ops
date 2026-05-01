import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AuditPanel from "./AuditPanel";

function mkEntries(n: number, startIso = "2026-04-30T00:00:00Z") {
  const start = new Date(startIso).getTime();
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i}`,
    projectId: "p1",
    userId: "u1",
    action: "project.update",
    details: null,
    // Descending createdAt so the last row is the oldest cursor.
    createdAt: new Date(start - i * 1000).toISOString(),
    userEmail: "owner@x.com",
  }));
}

beforeEach(() => {
  vi.spyOn(global, "fetch");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("AuditPanel", () => {
  it("renders entries returned by the API", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify([
          {
            id: "a1",
            projectId: "p1",
            userId: "u1",
            action: "project.update",
            details: null,
            createdAt: "2026-04-30T12:00:00Z",
            userEmail: "owner@x.com",
          },
        ]),
        { status: 200 },
      ),
    );
    render(<AuditPanel projectId="p1" />);
    expect(await screen.findByText("Updated project fields")).toBeInTheDocument();
    expect(screen.getByText("owner@x.com")).toBeInTheDocument();
  });

  it("hides the panel for sharees (403)", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("", { status: 403 }));
    const { container } = render(<AuditPanel projectId="p1" />);
    await waitFor(() => {
      expect(container.textContent ?? "").not.toContain("Activity");
    });
  });

  it("renders empty state", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("[]", { status: 200 }));
    render(<AuditPanel projectId="p1" />);
    expect(await screen.findByText(/no activity yet/i)).toBeInTheDocument();
  });

  it("shows error state on network failure", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("network down"));
    render(<AuditPanel projectId="p1" />);
    expect(await screen.findByText(/could not load/i)).toBeInTheDocument();
  });

  it("hides Load more when fewer than page-size rows are returned", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(mkEntries(3)), { status: 200 }),
    );
    render(<AuditPanel projectId="p1" />);
    const items = await screen.findAllByText("Updated project fields");
    expect(items.length).toBe(3);
    expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
  });

  it("shows Load more when full page returned and fetches next page with `before` cursor", async () => {
    const firstPage = mkEntries(50);
    const oldestCursor = firstPage[firstPage.length - 1]!.createdAt;
    const secondPage = mkEntries(2, "2026-04-29T00:00:00Z").map((e, i) => ({
      ...e,
      id: `next${i}`,
    }));
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify(firstPage), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(secondPage), { status: 200 }));
    render(<AuditPanel projectId="p1" />);
    const btn = await screen.findByRole("button", { name: /load more/i });
    fireEvent.click(btn);
    await waitFor(() => {
      const calls = vi.mocked(global.fetch).mock.calls;
      expect(calls.length).toBe(2);
      const url = String(calls[1]![0]);
      expect(url).toContain(`before=${encodeURIComponent(oldestCursor)}`);
      expect(url).toContain("limit=50");
    });
    // Load more should hide once a short page returns.
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /load more/i })).not.toBeInTheDocument();
    });
  });
});
