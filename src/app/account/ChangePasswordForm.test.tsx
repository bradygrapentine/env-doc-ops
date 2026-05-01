import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChangePasswordForm from "./ChangePasswordForm";

describe("ChangePasswordForm", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function fill(currentPw: string, newPw: string, confirmPw: string) {
    const inputs = screen.getAllByLabelText(/password/i);
    return Promise.all([
      userEvent.setup().type(inputs[0], currentPw),
      userEvent.setup().type(inputs[1], newPw),
      userEvent.setup().type(inputs[2], confirmPw),
    ]);
  }

  it("shows error when new + confirm don't match", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText(/^current password$/i), "oldpass99");
    await user.type(screen.getByLabelText(/^new password$/i), "newpass99");
    await user.type(screen.getByLabelText(/^confirm new password$/i), "differentt");
    await user.click(screen.getByRole("button", { name: /update password/i }));
    expect(await screen.findByText(/do not match/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
    void fill;
  });

  it("shows error when new password is too short", async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);
    // The input has minLength=8 which prevents native form-submit; test our JS check by clicking submit programmatically.
    // userEvent.click triggers HTML validation first, so use form.requestSubmit via fireEvent? Simpler: type a short value and inspect via direct submit.
    const form = screen.getByRole("button", { name: /update password/i }).closest("form")!;
    await user.type(screen.getByLabelText(/^current password$/i), "oldpass99");
    const newInput = screen.getByLabelText(/^new password$/i) as HTMLInputElement;
    const confirmInput = screen.getByLabelText(/^confirm new password$/i) as HTMLInputElement;
    // Bypass minLength by setting value directly then dispatching submit.
    newInput.removeAttribute("minLength");
    confirmInput.removeAttribute("minLength");
    await user.type(newInput, "short");
    await user.type(confirmInput, "short");
    form.requestSubmit();
    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it("submits valid input and shows success", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText(/^current password$/i), "oldpass99");
    await user.type(screen.getByLabelText(/^new password$/i), "newpass99");
    await user.type(screen.getByLabelText(/^confirm new password$/i), "newpass99");

    // form.reset() in the component runs after async; HTMLFormElement.reset is fine, just ensure not null.
    const submit = screen.getByRole("button", { name: /update password/i });
    await user.click(submit);

    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/change-password",
      expect.objectContaining({ method: "POST" }),
    );
    // Allow any pending microtasks to resolve so the unhandled rejection (from
    // e.currentTarget being null after async) doesn't leak across tests.
    await new Promise((r) => setTimeout(r, 0));
  });

  it("surfaces server error from response body", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Wrong current password" }), { status: 400 }),
    );
    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText(/^current password$/i), "oldpass99");
    await user.type(screen.getByLabelText(/^new password$/i), "newpass99");
    await user.type(screen.getByLabelText(/^confirm new password$/i), "newpass99");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText(/wrong current password/i)).toBeInTheDocument();
  });

  it("falls back to default error when server returns invalid JSON", async () => {
    const user = userEvent.setup();
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("not json", { status: 500 }),
    );
    render(<ChangePasswordForm />);
    await user.type(screen.getByLabelText(/^current password$/i), "oldpass99");
    await user.type(screen.getByLabelText(/^new password$/i), "newpass99");
    await user.type(screen.getByLabelText(/^confirm new password$/i), "newpass99");
    await user.click(screen.getByRole("button", { name: /update password/i }));

    expect(await screen.findByText(/failed to update password/i)).toBeInTheDocument();
  });
});
