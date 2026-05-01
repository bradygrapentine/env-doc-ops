import { NextResponse } from "next/server";
import { userRepo } from "@/lib/db";
import { tokenRepo } from "@/lib/tokens";

// GET is a non-consuming peek — it returns the new email for a valid token so
// the confirmation page can show the user what they're about to confirm.
// Mail clients, corporate URL scanners, and link-preview prefetchers fetch
// URLs proactively, so this MUST NOT mark the token used. Consumption only
// happens on POST, which the page issues after an explicit user click.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "missing" }, { status: 404 });
  }
  const peeked = tokenRepo.peekEmailChange(token);
  if ("error" in peeked) {
    return NextResponse.json({ error: peeked.error }, { status: 404 });
  }
  return NextResponse.json({ newEmail: peeked.newEmail });
}

// POST is the consuming step: only fired when the user clicks Confirm on the
// page. Rotates the email and marks the token used.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : null;
  if (!token) {
    return NextResponse.json({ error: "missing" }, { status: 400 });
  }
  const result = tokenRepo.consumeEmailChange(token);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  // Two layers of conflict handling: a fast-path read so the common case
  // returns conflict cleanly, and a try/catch so the narrow TOCTOU window
  // (concurrent UPDATE racing past the read) also surfaces as conflict
  // instead of a 500. users.email has a UNIQUE constraint that backs this.
  if (userRepo.findByEmail(result.newEmail)) {
    return NextResponse.json({ error: "conflict" }, { status: 409 });
  }
  try {
    userRepo.updateEmail(result.userId, result.newEmail);
  } catch (err) {
    if ((err as Error).message?.includes("UNIQUE constraint failed")) {
      return NextResponse.json({ error: "conflict" }, { status: 409 });
    }
    throw err;
  }
  return NextResponse.json({ ok: true });
}
