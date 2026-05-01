import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ManualInputsForm from "./ManualInputsForm";

describe("ManualInputsForm", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders initial values", () => {
    render(
      <ManualInputsForm
        projectId="p1"
        initial={{
          growthRate: "1%",
          tripGenAssumptions: "ITE 9th",
          mitigationNotes: "none",
          engineerConclusions: "fine",
        }}
      />,
    );
    expect(screen.getByDisplayValue("1%")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ITE 9th")).toBeInTheDocument();
    expect(screen.getByDisplayValue("none")).toBeInTheDocument();
    expect(screen.getByDisplayValue("fine")).toBeInTheDocument();
  });

  it("renders empty defaults when no initial provided", () => {
    render(<ManualInputsForm projectId="p1" />);
    expect(screen.getByLabelText(/background growth rate/i)).toHaveValue("");
  });

  it("saves via PATCH and shows saved state", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    render(<ManualInputsForm projectId="p1" />);
    const ta = screen.getByLabelText(/engineer conclusions/i);
    await user.type(ta, "ok");
    await user.click(screen.getByRole("button", { name: /^save$/i }));

    expect(await screen.findByText(/^saved\.$/i)).toBeInTheDocument();
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(call[0]).toBe("/api/projects/p1");
    expect(call[1].method).toBe("PATCH");
    expect(JSON.parse(call[1].body).manualInputs.engineerConclusions).toBe("ok");
  });

  it("shows error returned by server", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "nope" }), { status: 400 }),
    );
    render(<ManualInputsForm projectId="p1" />);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/nope/i)).toBeInTheDocument();
  });

  it("falls back to a generic error on bad JSON response", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("html", { status: 500 }),
    );
    render(<ManualInputsForm projectId="p1" />);
    await user.click(screen.getByRole("button", { name: /^save$/i }));
    expect(await screen.findByText(/save failed \(500\)/i)).toBeInTheDocument();
  });
});
