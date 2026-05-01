import type { NextAuthConfig } from "next-auth";

export default {
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) token.id = user.id;
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user && token.id) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
