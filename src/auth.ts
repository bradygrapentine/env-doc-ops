import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import authConfig from "./auth.config";
import { userRepo } from "@/lib/db";
import { isUnauthenticatedBlocked, SIGNIN_BUCKET } from "@/lib/rate-limit-policy";
import { resetSucceeded } from "@/lib/rate-limit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Rate-limit by submitted email. Auth.js Credentials.authorize can only
      // return User|null, so over-limit silently fails — attacker can't tell
      // a 429 from a wrong-password null. Email-keyed (not IP-keyed) because
      // (a) credential-stuffing target is one account at a time, (b) several
      // legit users behind one NAT shouldn't lock each other out.
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? "")
          .trim()
          .toLowerCase();
        const password = String(credentials?.password ?? "");
        if (!email || !password) return null;
        if (isUnauthenticatedBlocked(email, "signin", SIGNIN_BUCKET)) return null;
        const user = await userRepo.findByEmail(email);
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;
        resetSucceeded(email, "signin");
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
