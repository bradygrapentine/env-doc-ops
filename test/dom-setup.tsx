import "./env";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// jsdom's URL.createObjectURL implementation calls blob.stream(), which the
// Response polyfill in some Node versions doesn't expose. Tests don't care
// about the URL value — only that the export-blob plumbing fires.
if (typeof URL !== "undefined") {
  URL.createObjectURL = vi.fn(() => "blob:mock") as typeof URL.createObjectURL;
  URL.revokeObjectURL = vi.fn() as typeof URL.revokeObjectURL;
}

vi.mock("next/navigation", () => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  };
  const params = new URLSearchParams();
  return {
    useRouter: () => router,
    useSearchParams: () => params,
    usePathname: () => "/",
    useParams: () => ({}),
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    notFound: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
  };
});

vi.mock("next-auth/react", () => ({
  signIn: vi.fn(async () => ({ ok: true, error: null })),
  signOut: vi.fn(async () => ({ url: "/signin" })),
  useSession: () => ({ data: null, status: "unauthenticated", update: vi.fn() }),
  SessionProvider: (props: { children: React.ReactNode }) => props.children,
}));

vi.mock("next/link", () => ({
  default: (props: { href: string; children: React.ReactNode } & Record<string, unknown>) => {
    const { href, children, ...rest } = props;
    return React.createElement("a", { href, ...rest }, children as React.ReactNode);
  },
}));
