/**
 * Resolve the base URL to use in outbound email links. Prefer AUTH_URL
 * (a server-side env we control) over the request's Origin header (which
 * an authenticated attacker can spoof — they could send themselves a
 * change-email request from `Origin: https://evil.example` and the link
 * we mail them would point at the spoofed host while carrying our token).
 *
 * Fall back to the request-derived value only when AUTH_URL is unset
 * (i.e. local dev without env wiring). Tests pin AUTH_URL via setup.
 */
export function emailLinkBase(req: Request): string {
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  const fromHeader = req.headers.get("origin");
  if (fromHeader) return fromHeader;
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

type CapturedEmail = {
  to: string;
  subject: string;
  body: string;
  link: string;
};

const captured: CapturedEmail[] = [];

export function getCapturedEmails(): CapturedEmail[] {
  return captured;
}

export function clearCapturedEmails(): void {
  captured.length = 0;
}

function isMemorySink(): boolean {
  return process.env.EMAIL_SINK === "memory" || process.env.NODE_ENV === "test";
}

async function send(to: string, subject: string, body: string, link: string): Promise<void> {
  if (isMemorySink()) {
    captured.push({ to, subject, body, link });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.warn(
      "[email] RESEND_API_KEY or EMAIL_FROM not configured — skipping email send to",
      to,
    );
    return;
  }

  try {
    // Lazy import so tests/dev without resend installed never load it.
    const { Resend } = await import("resend");
    const client = new Resend(apiKey);
    await client.emails.send({ from, to, subject, text: body });
  } catch (err) {
    console.warn("[email] failed to send:", (err as Error).message);
  }
}

export async function sendVerificationEmail(to: string, link: string): Promise<void> {
  const subject = "Verify your EnvDocOS Traffic account";
  const body = `Welcome to EnvDocOS Traffic.\n\nPlease verify your email by clicking the link below:\n\n${link}\n\nThis link expires in 24 hours.\n`;
  await send(to, subject, body, link);
}

export async function sendPasswordResetEmail(to: string, link: string): Promise<void> {
  const subject = "Reset your EnvDocOS Traffic password";
  const body = `A password reset was requested for your EnvDocOS Traffic account.\n\nClick the link below to set a new password:\n\n${link}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.\n`;
  await send(to, subject, body, link);
}

export async function sendEmailChangeConfirmation(to: string, link: string): Promise<void> {
  const subject = "Confirm your new EnvDocOS Traffic email address";
  const body = `An email change was requested for your EnvDocOS Traffic account.\n\nConfirm this is your new email by clicking the link below:\n\n${link}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.\n`;
  await send(to, subject, body, link);
}
