import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import DeleteButton from "./DeleteButton";

describe("DeleteButton", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("opens a confirm modal on click", async () => {
    const user = userEvent.setup();
    render(<DeleteButton projectId="p1" projectName="Acme Project" />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(screen.getByText(/delete project\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Acme Project/)).toBeInTheDocument();
  });

  it("closes when Cancel is clicked", async () => {
    const user = userEvent.setup();
    render(<DeleteButton projectId="p1" projectName="Acme" />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByText(/delete project\?/i)).not.toBeInTheDocument();
  });

  it("fires DELETE and navigates on success", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, { status: 204 }),
    );
    const router = useRouter();
    render(<DeleteButton projectId="proj-123" projectName="Acme" />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getAllByRole("button", { name: /^delete$/i })[1]);
    expect(global.fetch).toHaveBeenCalledWith("/api/projects/proj-123", { method: "DELETE" });
    expect(router.push).toHaveBeenCalledWith("/");
  });

  it("surfaces server error and stays open", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 }),
    );
    render(<DeleteButton projectId="p1" projectName="Acme" />);
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(screen.getAllByRole("button", { name: /^delete$/i })[1]);
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
    expect(screen.getByText(/delete project\?/i)).toBeInTheDocument();
  });
});
