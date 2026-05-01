import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as nav from "next/navigation";
import EmailVerificationStatus from "./EmailVerificationStatus";

describe("EmailVerificationStatus", () => {
  beforeEach(() => {
    vi.spyOn(global, "fetch");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows green banner when ?verified=1", () => {
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams("verified=1") as unknown as ReturnType<typeof nav.useSearchParams>,
    );
    render(<EmailVerificationStatus verified={true} />);
    expect(screen.getByText(/email verified\./i)).toBeInTheDocument();
  });

  it("shows red banner when ?verified=error", () => {
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams("verified=error") as unknown as ReturnType<typeof nav.useSearchParams>,
    );
    render(<EmailVerificationStatus verified={false} />);
    expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument();
  });

  it("hides resend banner when verified=true", () => {
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof nav.useSearchParams>,
    );
    render(<EmailVerificationStatus verified={true} />);
    expect(screen.queryByText(/email not verified/i)).not.toBeInTheDocument();
  });

  it("shows resend button and triggers POST when clicked", async () => {
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof nav.useSearchParams>,
    );
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(null, { status: 200 }),
    );
    const user = userEvent.setup();
    render(<EmailVerificationStatus verified={false} />);
    await user.click(screen.getByRole("button", { name: /resend verification email/i }));
    expect(global.fetch).toHaveBeenCalledWith("/api/auth/send-verification", { method: "POST" });
    expect(await screen.findByText(/verification email sent/i)).toBeInTheDocument();
  });

  it("shows server error from JSON body", async () => {
    vi.spyOn(nav, "useSearchParams").mockReturnValue(
      new URLSearchParams() as unknown as ReturnType<typeof nav.useSearchParams>,
    );
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "rate limited" }), { status: 429 }),
    );
    const user = userEvent.setup();
    render(<EmailVerificationStatus verified={false} />);
    await user.click(screen.getByRole("button", { name: /resend verification email/i }));
    expect(await screen.findByText(/rate limited/i)).toBeInTheDocument();
  });
});
