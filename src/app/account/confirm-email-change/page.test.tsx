import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as nav from "next/navigation";
import ConfirmEmailChangePage from "./page";

const router = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
};

function setToken(token: string) {
  vi.spyOn(nav, "useSearchParams").mockReturnValue(
    new URLSearchParams(`token=${token}`) as unknown as ReturnType<typeof nav.useSearchParams>,
  );
}

describe("ConfirmEmailChangePage", () => {
  beforeEach(() => {
    router.push.mockClear();
    vi.spyOn(nav, "useRouter").mockReturnValue(
      router as unknown as ReturnType<typeof nav.useRouter>,
    );
    vi.spyOn(global, "fetch");
  });
  afterEach(() => vi.restoreAllMocks());

  it("calls peek GET on mount and renders the new email + Confirm/Cancel", async () => {
    setToken("abc");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ newEmail: "new@example.com" }), { status: 200 }),
    );
    render(<ConfirmEmailChangePage />);
    expect(await screen.findByText(/new@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /^cancel$/i })).toBeEnabled();
    // Confirm: peek call was a GET (NOT a POST) so prefetchers don't consume.
    const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const init = (call[1] ?? {}) as RequestInit;
    expect(init.method ?? "GET").toBe("GET");
    expect(String(call[0])).toContain("token=abc");
  });

  it("Confirm POSTs the token and navigates to /account?email_change=ok", async () => {
    setToken("abc");
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ newEmail: "new@example.com" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const user = userEvent.setup();
    render(<ConfirmEmailChangePage />);
    await user.click(await screen.findByRole("button", { name: /^confirm$/i }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/account?email_change=ok"));
    const postCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[1]!;
    expect((postCall[1] as RequestInit).method).toBe("POST");
    expect(String((postCall[1] as RequestInit).body)).toContain("abc");
  });

  it("surfaces server error inline on POST failure", async () => {
    setToken("abc");
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ newEmail: "new@example.com" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: "expired" }), { status: 400 }));
    const user = userEvent.setup();
    render(<ConfirmEmailChangePage />);
    await user.click(await screen.findByRole("button", { name: /^confirm$/i }));
    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Cancel navigates back to /account without POSTing", async () => {
    setToken("abc");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ newEmail: "new@example.com" }), { status: 200 }),
    );
    const user = userEvent.setup();
    render(<ConfirmEmailChangePage />);
    await user.click(await screen.findByRole("button", { name: /^cancel$/i }));
    expect(router.push).toHaveBeenCalledWith("/account");
    // Only the peek fetch should have been called.
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(1);
  });

  it("renders an inline error when the peek returns 404 (used/expired/invalid)", async () => {
    setToken("badtoken");
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "used" }), { status: 404 }),
    );
    render(<ConfirmEmailChangePage />);
    expect(await screen.findByText(/used/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
  });

  it("shows error and no Confirm button when token is missing", async () => {
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof nav.useSearchParams>,
    );
    render(<ConfirmEmailChangePage />);
    expect(await screen.findByText(/missing/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument();
  });
});
