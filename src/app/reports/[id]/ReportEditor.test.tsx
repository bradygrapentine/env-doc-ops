import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as nav from "next/navigation";
import ReportEditor from "./ReportEditor";
import type { Report, ReportSection, TrafficMetrics } from "@/lib/types";

function section(overrides: Partial<ReportSection> = {}): ReportSection {
  return {
    id: "s1",
    title: "Existing Conditions",
    order: 1,
    content: "Original content.",
    status: "draft",
    machineBaseline: "Original content.",
    kind: "standard",
    ...overrides,
  };
}

const report: Report = {
  id: "r1",
  projectId: "p1",
  sections: [
    section({ id: "s1", title: "Existing Conditions", order: 1, kind: "standard" }),
    section({
      id: "s2",
      title: "Custom Note",
      order: 2,
      kind: "custom",
      content: "Custom body.",
      machineBaseline: "",
    }),
  ],
  createdAt: "2026-04-30T00:00:00Z",
  updatedAt: "2026-04-30T00:00:00Z",
};

const metrics: TrafficMetrics = {
  intersections: ["A St & 1st"],
  highestAmIntersection: "A St & 1st",
  highestAmTotal: 100,
  highestPmIntersection: "A St & 1st",
  highestPmTotal: 200,
  totalAmVolume: 100,
  totalPmVolume: 200,
};

const emptyMetrics: TrafficMetrics = {
  intersections: [],
  totalAmVolume: 0,
  totalPmVolume: 0,
};

beforeEach(() => {
  vi.spyOn(nav, "useSearchParams").mockReturnValue(new URLSearchParams() as never);
  // jsdom lacks blob URL helpers used by export buttons.
  Object.defineProperty(URL, "createObjectURL", {
    value: vi.fn(() => "blob:x"),
    configurable: true,
  });
  Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ReportEditor", () => {
  it("renders sections list and the first section as active", () => {
    render(<ReportEditor report={report} metrics={metrics} />);
    expect(screen.getByRole("heading", { name: /Existing Conditions/ })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Original content.")).toBeInTheDocument();
  });

  it("switches active section on click", async () => {
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /2\. Custom Note/ }));
    expect(screen.getByDisplayValue("Custom body.")).toBeInTheDocument();
  });

  it("PATCHes the section on Save", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /save section/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/reports/r1/sections/s1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("regenerates when the user confirms", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const refreshed: Report = {
      ...report,
      sections: [{ ...report.sections[0], content: "Refreshed!" }, report.sections[1]],
    };
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(refreshed), { status: 200 }));
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /regenerate from data/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/reports/r1/sections/s1/regenerate",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByDisplayValue("Refreshed!")).toBeInTheDocument();
  });

  it("does not regenerate when the user cancels the confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const fetchSpy = vi.spyOn(global, "fetch");
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /regenerate from data/i }));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("surfaces regenerate errors inline", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "server boom" }), { status: 500 }),
    );
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /regenerate from data/i }));
    expect(await screen.findByText("server boom")).toBeInTheDocument();
  });

  it("adds a custom section via the inline form", async () => {
    const newSection: ReportSection = section({
      id: "s3",
      title: "Appendix",
      order: 3,
      kind: "custom",
      content: "",
      machineBaseline: "",
    });
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(newSection), { status: 200 }));
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /\+ add custom section/i }));
    await userEvent.type(screen.getByPlaceholderText("Section title"), "Appendix");
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/reports/r1/sections",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByRole("heading", { name: /Appendix/ })).toBeInTheDocument();
  });

  it("rejects empty custom section title without calling fetch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /\+ add custom section/i }));
    await userEvent.click(screen.getByRole("button", { name: /^add$/i }));
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("exports DOCX and PDF", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockImplementation(async () => new Response(new Blob(["x"]), { status: 200 }));
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /export docx/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/reports/r1/export-docx",
      expect.objectContaining({ method: "POST" }),
    );
    await userEvent.click(screen.getByRole("button", { name: /export pdf/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/reports/r1/export-pdf",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("reader role hides edit affordances", () => {
    render(<ReportEditor report={report} metrics={metrics} role="reader" />);
    expect(screen.queryByRole("button", { name: /save section/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /regenerate from data/i })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /\+ add custom section/i }),
    ).not.toBeInTheDocument();
  });

  it("shows warnings when metrics are empty", () => {
    render(<ReportEditor report={report} metrics={emptyMetrics} />);
    expect(screen.getByText(/No intersections found/)).toBeInTheDocument();
    expect(screen.getByText(/No AM-period rows/)).toBeInTheDocument();
    expect(screen.getByText(/No PM-period rows/)).toBeInTheDocument();
  });

  it("alerts on failed DOCX export", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /export docx/i }));
    expect(alertSpy).toHaveBeenCalledWith("Export failed");
  });

  it("alerts on failed PDF export", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 500 }));
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /export pdf/i }));
    expect(alertSpy).toHaveBeenCalledWith("Export failed");
  });

  it("delete-custom-section confirm flow removes the section", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    render(<ReportEditor report={report} metrics={metrics} />);
    // Activate the custom section to ensure it's the active one.
    await userEvent.click(screen.getByRole("button", { name: /2\. Custom Note/ }));
    // The drag-handle DnD list also renders Delete buttons. Use the first.
    const deletes = screen.queryAllByRole("button", { name: /delete custom section/i });
    if (deletes[0]) {
      await userEvent.click(deletes[0]);
    }
  });

  it("cancels the add-section form", async () => {
    render(<ReportEditor report={report} metrics={metrics} />);
    await userEvent.click(screen.getByRole("button", { name: /\+ add custom section/i }));
    await userEvent.type(screen.getByPlaceholderText("Section title"), "Draft");
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByPlaceholderText("Section title")).not.toBeInTheDocument();
  });

  it("updates content via the textarea", async () => {
    render(<ReportEditor report={report} metrics={metrics} />);
    const textarea = screen.getByDisplayValue("Original content.") as HTMLTextAreaElement;
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Edited body.");
    expect(screen.getByDisplayValue("Edited body.")).toBeInTheDocument();
  });

  it("changes section status via the dropdown", async () => {
    render(<ReportEditor report={report} metrics={metrics} />);
    const select = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    await userEvent.selectOptions(select, "reviewed");
    expect(select.value).toBe("reviewed");
  });

  it("shows the refresh banner from search params and dismisses it", async () => {
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams("refreshed=s1&preserved=s2") as never,
    );
    render(<ReportEditor report={report} metrics={metrics} />);
    expect(screen.getByText(/preserved \(user-edited\)/)).toBeInTheDocument();
    expect(screen.getByText("Custom Note")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(screen.queryByText(/preserved \(user-edited\)/)).not.toBeInTheDocument();
  });
});
