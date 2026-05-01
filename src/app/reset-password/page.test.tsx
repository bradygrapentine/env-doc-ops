import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as nav from "next/navigation";
import ResetPasswordPage from "./page";

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams("token=abc") as unknown as ReturnType<typeof nav.useSearchParams>,
    );
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders form when token is present", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByRole("button", { name: /reset password/i })).toBeEnabled();
  });

  it("disables submit and shows error when token missing", () => {
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof nav.useSearchParams>,
    );
    render(<ResetPasswordPage />);
    expect(screen.getByRole("button", { name: /reset password/i })).toBeDisabled();
    expect(screen.getByText(/missing or invalid token/i)).toBeInTheDocument();
  });

  it("shows mismatch error", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText(/^new password$/i), "12345678");
    await user.type(screen.getByLabelText(/confirm new password/i), "abcdefgh");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
  });

  it("submits and shows success", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText(/^new password$/i), "newpass99");
    await user.type(screen.getByLabelText(/confirm new password/i), "newpass99");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/password reset\. you can now sign in/i)).toBeInTheDocument();
  });

  it("shows server error from JSON body", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "expired" }), { status: 400 }),
    );
    render(<ResetPasswordPage />);
    await user.type(screen.getByLabelText(/^new password$/i), "newpass99");
    await user.type(screen.getByLabelText(/confirm new password/i), "newpass99");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/expired/i)).toBeInTheDocument();
  });

  it("rejects passwords shorter than 8 chars (post-bypass of HTML minLength)", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordPage />);
    const newPw = screen.getByLabelText(/^new password$/i) as HTMLInputElement;
    const confirm = screen.getByLabelText(/confirm new password/i) as HTMLInputElement;
    newPw.removeAttribute("minLength");
    confirm.removeAttribute("minLength");
    await user.type(newPw, "short");
    await user.type(confirm, "short");
    await user.click(screen.getByRole("button", { name: /reset password/i }));
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });
});
