import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SharesPanel from "./SharesPanel";

const SHARE = {
  userId: "u1",
  email: "u1@x.com",
  name: "User One",
  role: "reader" as const,
  createdAt: "2024-01-01",
};

describe("SharesPanel", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows loading then empty state", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    render(<SharesPanel projectId="p1" />);
    expect(await screen.findByText(/not shared with anyone/i)).toBeInTheDocument();
  });

  it("lists existing shares", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify([SHARE]), { status: 200 }),
    );
    render(<SharesPanel projectId="p1" />);
    expect(await screen.findByText("User One")).toBeInTheDocument();
    expect(screen.getByText(/u1@x\.com/)).toBeInTheDocument();
  });

  it("invite POSTs to API and adds the share", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(SHARE), { status: 200 }));
    render(<SharesPanel projectId="p1" />);
    await waitFor(() => screen.getByLabelText(/invite by email/i));
    await user.type(screen.getByLabelText(/invite by email/i), "u1@x.com");
    await user.click(screen.getByRole("button", { name: /^invite$/i }));
    expect(await screen.findByText("User One")).toBeInTheDocument();
  });

  it("invite shows server error", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "no such user" }), { status: 400 }),
      );
    render(<SharesPanel projectId="p1" />);
    await waitFor(() => screen.getByLabelText(/invite by email/i));
    await user.type(screen.getByLabelText(/invite by email/i), "x@x.com");
    await user.click(screen.getByRole("button", { name: /^invite$/i }));
    expect(await screen.findByText(/no such user/i)).toBeInTheDocument();
  });

  it("invite requires non-empty email", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify([]), { status: 200 }),
    );
    render(<SharesPanel projectId="p1" />);
    await waitFor(() => screen.getByLabelText(/invite by email/i));
    const button = screen.getByRole("button", { name: /^invite$/i });
    // Bypass HTML required by removing it
    const input = screen.getByLabelText(/invite by email/i) as HTMLInputElement;
    input.removeAttribute("required");
    input.removeAttribute("type");
    await user.click(button);
    expect(await screen.findByText(/email is required/i)).toBeInTheDocument();
  });

  it("remove fires DELETE and updates the list", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(new Response(JSON.stringify([SHARE]), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    render(<SharesPanel projectId="p1" />);
    await screen.findByText("User One");
    await user.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(screen.queryByText("User One")).not.toBeInTheDocument());
  });
});
