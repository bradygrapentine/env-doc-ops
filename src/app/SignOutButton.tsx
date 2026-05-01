"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/signin" })}
      className="text-sm text-gray-600 hover:underline"
    >
      Sign out
    </button>
  );
}
