import type { NextAuthConfig } from "next-auth";

export default {
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    process.env.BETTER_AUTH_SECRET,
  providers: [],
  pages: { signIn: "/login" },
} satisfies NextAuthConfig;
