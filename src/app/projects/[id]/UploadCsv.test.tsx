import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UploadCsv from "./UploadCsv";

const csv = "intersection,period,inbound,outbound,total\nA,AM,10,5,15\n";

function csvFile(text = csv) {
  return new File([text], "counts.csv", { type: "text/csv" });
}

function fileInput(): HTMLInputElement {
  const el = document.querySelector('input[type="file"]');
  if (!el) throw new Error("file input not found");
  return el as HTMLInputElement;
}

beforeEach(() => {
  vi.spyOn(global, "fetch");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("UploadCsv", () => {
  it("shows the initial imported row count", () => {
    render(<UploadCsv projectId="p1" initialRowCount={5} />);
    expect(screen.getByText("5 rows imported.")).toBeInTheDocument();
  });

  it("previews the CSV and shows a row table", async () => {
    const fetchMock = vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          headers: ["intersection", "period", "inbound", "outbound", "total"],
          totalRows: 1,
          validRows: [{ intersection: "A", period: "AM", inbound: 10, outbound: 5, total: 15 }],
          invalidRows: [],
        }),
        { status: 200 },
      ),
    );
    render(<UploadCsv projectId="p1" initialRowCount={0} />);
    await userEvent.upload(fileInput(), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/p1/traffic-data/preview",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByRole("button", { name: /confirm import \(1 rows\)/i })).toBeEnabled();
  });

  it("disables confirm import when there are invalid rows", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          headers: ["intersection"],
          totalRows: 1,
          validRows: [],
          invalidRows: [
            { row: 2, raw: { intersection: "A" }, issues: [{ row: 2, message: "missing period" }] },
          ],
        }),
        { status: 200 },
      ),
    );
    render(<UploadCsv projectId="p1" initialRowCount={0} />);
    await userEvent.upload(fileInput(), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    const confirmBtn = await screen.findByRole("button", {
      name: /confirm import \(resolve issues first\)/i,
    });
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText("missing period")).toBeInTheDocument();
  });

  it("imports valid rows after confirm", async () => {
    const fetchMock = vi
      .mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            headers: [],
            totalRows: 1,
            validRows: [{ intersection: "A", period: "AM", inbound: 1, outbound: 1, total: 2 }],
            invalidRows: [],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ rowsImported: 1 }), { status: 200 }));
    render(<UploadCsv projectId="p1" initialRowCount={0} />);
    await userEvent.upload(fileInput(), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await userEvent.click(
      await screen.findByRole("button", { name: /confirm import \(1 rows\)/i }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/projects/p1/traffic-data",
      expect.objectContaining({ method: "POST" }),
    );
    expect(await screen.findByText("1 rows imported.")).toBeInTheDocument();
  });

  it("surfaces preview errors", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "bad header" }), { status: 400 }),
    );
    render(<UploadCsv projectId="p1" initialRowCount={0} />);
    await userEvent.upload(fileInput(), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    expect(await screen.findByText("bad header")).toBeInTheDocument();
  });

  it("generates report immediately when no preserved sections", async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ refreshed: [{ id: "s1", title: "x" }], preserved: [] }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ reportId: "r1", refreshed: ["s1"], preserved: [] }), {
          status: 200,
        }),
      );
    render(<UploadCsv projectId="p1" initialRowCount={3} />);
    await userEvent.click(screen.getByRole("button", { name: /generate report/i }));
    expect(vi.mocked(global.fetch).mock.calls.map((c) => c[0])).toEqual([
      "/api/projects/p1/generate-report/preview",
      "/api/projects/p1/generate-report",
    ]);
  });

  it("prompts for confirmation when preserved sections exist", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          refreshed: [{ id: "s1", title: "Existing" }],
          preserved: [{ id: "s2", title: "Edited Section" }],
        }),
        { status: 200 },
      ),
    );
    render(<UploadCsv projectId="p1" initialRowCount={3} />);
    await userEvent.click(screen.getByRole("button", { name: /generate report/i }));
    expect(await screen.findByText("Edited Section")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^refresh$/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.queryByText("Edited Section")).not.toBeInTheDocument();
  });

  it("resets the preview when picking a different file", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ headers: [], totalRows: 0, validRows: [], invalidRows: [] }), {
        status: 200,
      }),
    );
    render(<UploadCsv projectId="p1" initialRowCount={0} />);
    await userEvent.upload(fileInput(), csvFile());
    await userEvent.click(screen.getByRole("button", { name: /^preview$/i }));
    await userEvent.click(await screen.findByRole("button", { name: /pick a different file/i }));
    expect(
      screen.queryByRole("button", { name: /pick a different file/i }),
    ).not.toBeInTheDocument();
  });
});
