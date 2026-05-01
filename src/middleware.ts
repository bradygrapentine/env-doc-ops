import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import authConfig from "@/auth.config";

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = new Set(["/signin", "/signup", "/forgot-password", "/reset-password"]);
const PUBLIC_API_PREFIXES = ["/api/auth"];

export default auth((req) => {
  const { nextUrl } = req;
  const pathname = nextUrl.pathname;

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
