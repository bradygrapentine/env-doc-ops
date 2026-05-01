import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "EnvDocOS Traffic V1",
  description: "Traffic impact report compiler",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b bg-white">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
            <Link href="/" className="font-semibold text-lg">
              EnvDocOS Traffic V1
            </Link>
            <nav className="text-sm text-gray-600 flex gap-4">
              <Link href="/">Projects</Link>
              <Link href="/projects/new">New Project</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
