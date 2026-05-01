import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TrafficRowsManager from "./TrafficRowsManager";
import type { TrafficCountRow } from "@/lib/types";

const ROW: TrafficCountRow = {
  id: "r1",
  projectId: "p1",
  intersection: "Main & 1st",
  period: "AM",
  approach: "NB",
  inbound: 10,
  outbound: 5,
  total: 15,
  source: "manual",
  createdAt: "2024-01-01T00:00:00Z",
} as TrafficCountRow;

describe("TrafficRowsManager", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders existing rows", () => {
    render(<TrafficRowsManager projectId="p1" initialRows={[ROW]} />);
    expect(screen.getByText("Main & 1st")).toBeInTheDocument();
    expect(screen.getByText(/Imported rows \(1\)/)).toBeInTheDocument();
  });

  it("shows add form when + Add row clicked", async () => {
    const user = userEvent.setup();
    render(<TrafficRowsManager projectId="p1" initialRows={[]} />);
    await user.click(screen.getByRole("button", { name: /\+ add row/i }));
    expect(screen.getByPlaceholderText(/intersection/i)).toBeInTheDocument();
  });

  it("adds a row via POST and prepends it to the list", async () => {
    const user = userEvent.setup();
    const created = { ...ROW, id: "r2", intersection: "Oak" };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify(created), { status: 200 }),
    );
    render(<TrafficRowsManager projectId="p1" initialRows={[]} />);
    await user.click(screen.getByRole("button", { name: /\+ add row/i }));
    await user.type(screen.getByPlaceholderText(/intersection/i), "Oak");
    await user.type(screen.getByPlaceholderText(/inbound/i), "1");
    await user.type(screen.getByPlaceholderText(/outbound/i), "1");
    await user.type(screen.getByPlaceholderText(/^total$/i), "2");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/projects/p1/traffic-data/rows",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("Oak")).toBeInTheDocument();
  });

  it("shows server error on add failure including issues list", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Bad row", issues: [{ message: "inbound NaN" }] }), {
        status: 400,
      }),
    );
    render(<TrafficRowsManager projectId="p1" initialRows={[]} />);
    await user.click(screen.getByRole("button", { name: /\+ add row/i }));
    await user.type(screen.getByPlaceholderText(/intersection/i), "X");
    await user.click(screen.getByRole("button", { name: /^add$/i }));
    expect(await screen.findByText(/inbound NaN/i)).toBeInTheDocument();
  });

  it("deletes a row after confirm", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    render(<TrafficRowsManager projectId="p1" initialRows={[ROW]} />);
    const deleteBtn = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteBtn);
    await waitFor(() => expect(screen.queryByText("Main & 1st")).not.toBeInTheDocument());
  });

  it("does not delete when window.confirm is canceled", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TrafficRowsManager projectId="p1" initialRows={[ROW]} />);
    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(global.fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Main & 1st")).toBeInTheDocument();
  });
});
