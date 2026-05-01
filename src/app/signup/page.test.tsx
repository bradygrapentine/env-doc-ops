import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import SignUpPage from "./page";

describe("SignUpPage", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
    Object.defineProperty(window, "location", { writable: true, value: { href: "" } });
    (signIn as ReturnType<typeof vi.fn>).mockClear();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function fillAndSubmit() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/name/i), "Brady");
    await user.type(screen.getByLabelText(/email/i), "b@x.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /create account/i }));
  }

  it("renders an accessible form", () => {
    render(<SignUpPage />);
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("submits signup, then signs in on success", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, error: null, url: "/" });
    render(<SignUpPage />);
    await fillAndSubmit();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/auth/signup",
      expect.objectContaining({ method: "POST" }),
    );
    expect(signIn).toHaveBeenCalled();
  });

  it("shows server error when signup fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Email taken" }), { status: 400 }),
    );
    render(<SignUpPage />);
    await fillAndSubmit();
    expect(await screen.findByText(/email taken/i)).toBeInTheDocument();
    expect(signIn).not.toHaveBeenCalled();
  });

  it("shows fallback error when signup body is invalid JSON", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("oops", { status: 500 }),
    );
    render(<SignUpPage />);
    await fillAndSubmit();
    expect(await screen.findByText(/signup failed/i)).toBeInTheDocument();
  });

  it("shows fallback when sign-in fails after signup", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, error: "x" });
    render(<SignUpPage />);
    await fillAndSubmit();
    expect(await screen.findByText(/account created but sign-in failed/i)).toBeInTheDocument();
  });
});
