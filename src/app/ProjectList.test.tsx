import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectList from "./ProjectList";
import type { ProjectListEntry } from "@/lib/types";

function mk(p: Partial<ProjectListEntry> & { id: string; name: string }): ProjectListEntry {
  return {
    id: p.id,
    name: p.name,
    location: p.location ?? "Loc",
    jurisdiction: p.jurisdiction ?? "Juris",
    createdAt: p.createdAt ?? "2024-01-01T00:00:00Z",
    role: p.role ?? "owner",
  } as ProjectListEntry;
}

describe("ProjectList", () => {
  it("shows the empty state when no projects", () => {
    render(<ProjectList projects={[]} />);
    expect(screen.getByText(/no projects yet/i)).toBeInTheDocument();
  });

  it("renders all projects by default", () => {
    render(
      <ProjectList projects={[mk({ id: "a", name: "Alpha" }), mk({ id: "b", name: "Bravo" })]} />,
    );
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("filters by name", async () => {
    const user = userEvent.setup();
    render(
      <ProjectList projects={[mk({ id: "a", name: "Alpha" }), mk({ id: "b", name: "Bravo" })]} />,
    );
    await user.type(screen.getByPlaceholderText(/search projects/i), "alp");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();
  });

  it("filters by location and jurisdiction", async () => {
    const user = userEvent.setup();
    render(
      <ProjectList
        projects={[
          mk({ id: "a", name: "Alpha", location: "Boston", jurisdiction: "MA" }),
          mk({ id: "b", name: "Bravo", location: "Denver", jurisdiction: "CO" }),
        ]}
      />,
    );
    const input = screen.getByPlaceholderText(/search projects/i);
    await user.type(input, "boston");
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument();

    await user.clear(input);
    await user.type(input, "co");
    // 'co' matches "Bravo" name? No, but matches jurisdiction CO (case-insensitive) — and Alpha has no 'co' anywhere
    expect(screen.getByText("Bravo")).toBeInTheDocument();
  });

  it("shows no-matches state when search has no hits", async () => {
    const user = userEvent.setup();
    render(<ProjectList projects={[mk({ id: "a", name: "Alpha" })]} />);
    await user.type(screen.getByPlaceholderText(/search projects/i), "zzz");
    expect(screen.getByText(/no projects match/i)).toBeInTheDocument();
  });

  it("sorts newest, oldest, A→Z, Z→A", async () => {
    const user = userEvent.setup();
    const projects = [
      mk({ id: "a", name: "Beta", createdAt: "2024-02-01T00:00:00Z" }),
      mk({ id: "b", name: "Alpha", createdAt: "2024-01-01T00:00:00Z" }),
      mk({ id: "c", name: "Gamma", createdAt: "2024-03-01T00:00:00Z" }),
    ];
    const { container } = render(<ProjectList projects={projects} />);

    function names() {
      return Array.from(container.querySelectorAll("li .font-medium span"))
        .map((n) => n.textContent)
        .filter((t) => t && !t.match(/Shared/i));
    }

    // newest default
    expect(names()).toEqual(["Gamma", "Beta", "Alpha"]);

    const sortSelect = screen.getByLabelText(/sort projects/i);
    await user.selectOptions(sortSelect, "oldest");
    expect(names()).toEqual(["Alpha", "Beta", "Gamma"]);

    await user.selectOptions(sortSelect, "nameAsc");
    expect(names()).toEqual(["Alpha", "Beta", "Gamma"]);

    await user.selectOptions(sortSelect, "nameDesc");
    expect(names()).toEqual(["Gamma", "Beta", "Alpha"]);
  });

  it("shows a Shared badge for reader-role projects", () => {
    render(<ProjectList projects={[mk({ id: "a", name: "Alpha", role: "reader" as const })]} />);
    expect(screen.getByText(/shared/i)).toBeInTheDocument();
  });
});
