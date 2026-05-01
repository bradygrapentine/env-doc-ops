import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth } from "@/auth";
import SignOutButton from "./SignOutButton";

export const metadata: Metadata = {
  title: "EnvDocOS Traffic V1",
  description: "Traffic impact report compiler",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg">
              EnvDocOS Traffic V1
            </Link>
            <nav className="text-sm text-gray-600 flex gap-4 items-center">
              {user ? (
                <>
                  <Link href="/">Projects</Link>
                  <Link href="/projects/new">New Project</Link>
                  <span className="text-gray-400">·</span>
                  <span>{user.name ?? user.email}</span>
                  <SignOutButton />
                </>
              ) : (
                <>
                  <Link href="/signin">Sign in</Link>
                  <Link href="/signup">Sign up</Link>
                </>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
