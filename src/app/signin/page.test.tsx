import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { signIn } from "next-auth/react";
import SignInPage from "./page";

describe("SignInPage", () => {
  beforeEach(() => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders an accessible form", () => {
    render(<SignInPage />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByText(/forgot password\?/i)).toBeInTheDocument();
  });

  it("calls signIn with credentials on submit", async () => {
    const user = userEvent.setup();
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: true, error: null, url: "/" });
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "u@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(signIn).toHaveBeenCalledWith(
      "credentials",
      expect.objectContaining({ redirect: false, callbackUrl: "/" }),
    );
  });

  it("shows an error when signIn returns error", async () => {
    const user = userEvent.setup();
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, error: "BAD" });
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "u@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });

  it("shows an error when signIn returns null", async () => {
    const user = userEvent.setup();
    (signIn as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    render(<SignInPage />);
    await user.type(screen.getByLabelText(/email/i), "u@example.com");
    await user.type(screen.getByLabelText(/password/i), "secret123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));
    expect(await screen.findByText(/invalid email or password/i)).toBeInTheDocument();
  });
});
