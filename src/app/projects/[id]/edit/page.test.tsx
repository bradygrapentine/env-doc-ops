import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import EditProjectPage from "./page";
import type { Project } from "@/lib/types";

const project: Project = {
  id: "p1",
  userId: "u1",
  name: "Edit me",
  location: "City",
  jurisdiction: "Town",
  clientName: undefined,
  projectType: "Mixed",
  developmentSummary: "S",
  preparedBy: undefined,
  createdAt: "2026-04-30T00:00:00Z",
};

beforeEach(() => {
  vi.spyOn(global, "fetch");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("EditProjectPage", () => {
  it("renders the edit form once the project loads", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(project), { status: 200 }),
    );
    render(<EditProjectPage params={{ id: "p1" }} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Edit me")).toBeInTheDocument();
  });

  it("shows a not-found message on 404", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("", { status: 404 }));
    render(<EditProjectPage params={{ id: "p1" }} />);
    expect(await screen.findByText(/project not found/i)).toBeInTheDocument();
  });

  it("shows an error message on a non-ok response", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(new Response("", { status: 500 }));
    render(<EditProjectPage params={{ id: "p1" }} />);
    expect(await screen.findByText(/failed to load project/i)).toBeInTheDocument();
  });

  it("shows the failure message when fetch rejects", async () => {
    vi.mocked(global.fetch).mockRejectedValueOnce(new Error("net"));
    render(<EditProjectPage params={{ id: "p1" }} />);
    expect(await screen.findByText(/failed to load project/i)).toBeInTheDocument();
  });
});
