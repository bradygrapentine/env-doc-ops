import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import NewProjectPage from "./page";

describe("NewProjectPage", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });
  afterEach(() => vi.restoreAllMocks());

  async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(/^project name/i), "P");
    await user.type(screen.getByLabelText(/^location/i), "L");
    await user.type(screen.getByLabelText(/^jurisdiction/i), "J");
    await user.type(screen.getByLabelText(/^project type/i), "T");
    await user.type(screen.getByLabelText(/development summary/i), "D");
  }

  it("renders all fields", () => {
    render(<NewProjectPage />);
    expect(screen.getByLabelText(/project name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/development summary/i)).toBeInTheDocument();
  });

  it("posts and navigates on success", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ id: "p1" }), { status: 200 }),
    );
    const router = useRouter();
    render(<NewProjectPage />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /create project/i }));
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/projects",
      expect.objectContaining({ method: "POST" }),
    );
    expect(router.push).toHaveBeenCalledWith("/projects/p1");
  });

  it("shows server error on failure", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "nope" }), { status: 400 }),
    );
    render(<NewProjectPage />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /create project/i }));
    expect(await screen.findByText(/nope/i)).toBeInTheDocument();
  });

  it("falls back to default error when body is invalid json", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("oops", { status: 500 }),
    );
    render(<NewProjectPage />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /create project/i }));
    expect(await screen.findByText(/failed to create project/i)).toBeInTheDocument();
  });
});
