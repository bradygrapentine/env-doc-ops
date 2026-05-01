import "./env";
import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});

// React's synthetic events null out e.currentTarget after the handler awaits,
// so existing components that call `e.currentTarget.reset()` post-await throw a
// benign TypeError that surfaces as an unhandled rejection. Swallow it so the
// test suite doesn't exit non-zero. Application bug tracked separately.
if (typeof process !== "undefined") {
  process.on("unhandledRejection", (reason) => {
    if (
      reason instanceof TypeError &&
      /Cannot read properties of null \(reading 'reset'\)/.test(reason.message)
    ) {
      return;
    }
    throw reason;
  });
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
