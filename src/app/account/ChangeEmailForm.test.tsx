import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChangeEmailForm from "./ChangeEmailForm";

beforeEach(() => {
  vi.spyOn(global, "fetch");
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("ChangeEmailForm", () => {
  it("posts the new email + password to the change-email endpoint", async () => {
    const fetchSpy = vi
      .mocked(global.fetch)
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    render(<ChangeEmailForm currentEmail="me@x.com" />);
    await userEvent.type(screen.getByLabelText(/new email/i), "new@y.com");
    await userEvent.type(screen.getByLabelText(/current password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /send confirmation/i }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/auth/change-email",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchSpy.mock.calls[0]![1]!.body as string);
    expect(body.newEmail).toBe("new@y.com");
    expect(body.currentPassword).toBe("secret");
    expect(await screen.findByText(/confirmation link sent/i)).toBeInTheDocument();
  });

  it("blocks submission when new email matches current", async () => {
    const fetchSpy = vi.mocked(global.fetch);
    render(<ChangeEmailForm currentEmail="me@x.com" />);
    await userEvent.type(screen.getByLabelText(/new email/i), "me@x.com");
    await userEvent.type(screen.getByLabelText(/current password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /send confirmation/i }));
    expect(screen.getByText(/must differ/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("surfaces server errors", async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Email already in use" }), { status: 409 }),
    );
    render(<ChangeEmailForm currentEmail="me@x.com" />);
    await userEvent.type(screen.getByLabelText(/new email/i), "taken@y.com");
    await userEvent.type(screen.getByLabelText(/current password/i), "secret");
    await userEvent.click(screen.getByRole("button", { name: /send confirmation/i }));
    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
  });
});
