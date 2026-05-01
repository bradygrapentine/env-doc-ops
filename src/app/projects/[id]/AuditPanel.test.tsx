import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import AuditPanel from "./AuditPanel";

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
});
