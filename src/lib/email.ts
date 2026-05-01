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
