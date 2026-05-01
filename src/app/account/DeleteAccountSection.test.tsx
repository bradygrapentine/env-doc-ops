import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as nextAuth from "next-auth/react";
import DeleteAccountSection from "./DeleteAccountSection";

beforeEach(() => {
  vi.spyOn(global, "fetch");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("DeleteAccountSection", () => {
  it("shows the warning and arms on click", async () => {
    render(<DeleteAccountSection />);
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    expect(screen.getByPlaceholderText(/current password/i)).toBeInTheDocument();
  });

  it("cancels back to the warning", async () => {
    render(<DeleteAccountSection />);
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/current password/i)).not.toBeInTheDocument();
  });

  it("DELETEs the account and signs out on success", async () => {
    const fetchSpy = vi
      .mocked(global.fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const signOutSpy = vi.spyOn(nextAuth, "signOut").mockResolvedValue({ url: "/signin" } as never);
    render(<DeleteAccountSection />);
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await userEvent.type(screen.getByPlaceholderText(/current password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /confirm delete/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/account",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(signOutSpy).toHaveBeenCalled();
  });

  it("surfaces server errors", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Wrong password" }), { status: 401 }),
    );
    render(<DeleteAccountSection />);
    await userEvent.click(screen.getByRole("button", { name: /delete account/i }));
    await userEvent.type(screen.getByPlaceholderText(/current password/i), "x");
    await userEvent.click(screen.getByRole("button", { name: /confirm delete/i }));
    expect(await screen.findByText("Wrong password")).toBeInTheDocument();
  });
});
