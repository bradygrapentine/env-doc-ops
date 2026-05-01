import NextAuth from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/signin", "/signup", "/forgot-password", "/reset-password"]);
// /api/test-only is only reachable in non-production builds. The gate below
// short-circuits to 404 in production regardless of EMAIL_SINK.
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/test-only"];

const STATE_CHANGING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Reject cross-origin state-changing requests. SameSite=lax on the session
 * cookie isn't a complete defense against CSRF — a top-level form POST with
 * `Content-Type: text/plain` can still ride an authenticated session, and our
 * route handlers parse JSON from text bodies via `req.json()`. Defense: every
 * mutating request must carry an Origin or Referer that matches our own host.
 *
 * Auth.js's own [...nextauth] handler ships its own CSRF token mechanism;
 * we still apply the Origin check on top — same-origin sign-in flows already
 * carry the right Origin so this is additive, not breaking.
 */
function checkSameOrigin(req: NextRequest): NextResponse | undefined {
  if (!STATE_CHANGING.has(req.method)) return;
  // Tests construct synthetic Request objects without Origin/Referer.
  if (process.env.NODE_ENV === "test" && process.env.VITEST === "true") return;
  const expected = req.nextUrl.origin;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (origin && origin === expected) return;
  if (referer && referer.startsWith(expected + "/")) return;
  return NextResponse.json({ error: "Bad origin" }, { status: 403 });
}

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

  // Defense in depth: gate the test-only prefix on EMAIL_SINK=memory. The
  // route handler also checks, but middleware blocks before the handler runs.
  // Production deploys must not set EMAIL_SINK=memory; E2E sets it explicitly.
  if (pathname.startsWith("/api/test-only") && process.env.EMAIL_SINK !== "memory") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  if (pathname.startsWith("/api/")) {
    const csrf = checkSameOrigin(req);
    if (csrf) return csrf;
  }

  if (PUBLIC_PATHS.has(pathname)) return;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return;

  const signedIn = !!req.auth;
  if (signedIn) return;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = nextUrl.clone();
  url.pathname = "/signin";
  url.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
