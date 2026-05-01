import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditProjectForm from "./EditProjectForm";
import type { Project } from "@/lib/types";

const project: Project = {
  id: "p1",
  userId: "u1",
  name: "Original",
  location: "City",
  jurisdiction: "Town",
  clientName: "Client",
  projectType: "Mixed",
  developmentSummary: "Summary",
  preparedBy: "Engineer",
  createdAt: "2026-04-30T00:00:00Z",
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("EditProjectForm", () => {
  it("prefills inputs from the project prop", () => {
    render(<EditProjectForm project={project} />);
    expect(screen.getByDisplayValue("Original")).toBeInTheDocument();
    expect(screen.getByDisplayValue("City")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Town")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Client")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Mixed")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Summary")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Engineer")).toBeInTheDocument();
  });

  it("PATCHes the project on save and navigates back", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(project), { status: 200 }));
    render(<EditProjectForm project={project} />);
    await userEvent.clear(screen.getByDisplayValue("Original"));
    await userEvent.type(screen.getByLabelText(/Project name/), "Renamed");
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/projects/p1",
      expect.objectContaining({ method: "PATCH" }),
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1]!.body as string);
    expect(body.name).toBe("Renamed");
  });

  it("surfaces server errors inline", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Validation failed" }), { status: 400 }),
    );
    render(<EditProjectForm project={project} />);
    await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
    expect(await screen.findByText("Validation failed")).toBeInTheDocument();
  });

  it("Cancel link points back to the project page", () => {
    render(<EditProjectForm project={project} />);
    const cancel = screen.getByRole("link", { name: /cancel/i });
    expect(cancel).toHaveAttribute("href", "/projects/p1");
  });
});
