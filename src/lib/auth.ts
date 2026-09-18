import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { encode as defaultEncode } from "next-auth/jwt";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/lib/db";

/**
 * "Remember me" is implemented as two different JWT lifetimes rather than
 * an actual browser session-only cookie: Chrome and other browsers
 * routinely restore cookies across a full quit/relaunch ("continue where
 * you left off" session restore), so a cookie's Max-Age/Expires attribute
 * alone can't reliably guarantee "signs out when the browser closes." The
 * session cookie itself always physically persists up to REMEMBER_MAX_AGE
 * (see `session.maxAge` below -- that's what controls the cookie's own
 * Max-Age), but the JWT payload *inside* it carries a per-login
 * `rememberMaxAge`, and the custom `jwt.encode` below bakes that into the
 * token's real cryptographic expiration. So an un-"remembered" login's
 * cookie may still be sitting in the browser after a day, but the token
 * inside it will fail to decode/verify past DEFAULT_MAX_AGE, and
 * getServerSession() will see no session -- which is what actually signs
 * the person out.
 */
const REMEMBER_MAX_AGE = 30 * 24 * 60 * 60; // 30 days
const DEFAULT_MAX_AGE = 24 * 60 * 60; // 1 day

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: REMEMBER_MAX_AGE },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  jwt: {
    maxAge: REMEMBER_MAX_AGE,
    // Overrides the JWT's real expiration per-token instead of using the
    // fixed `maxAge` above for everyone -- see the comment on
    // REMEMBER_MAX_AGE/DEFAULT_MAX_AGE. `token.rememberMaxAge` is set once,
    // at sign-in, by the `jwt` callback below, and survives NextAuth's
    // periodic token refreshes (it's just another field on the token
    // payload), so a "remembered" session keeps re-extending itself by 30
    // days and a non-remembered one by 1, from whenever it was last used.
    async encode(params) {
      const remembered = params.token?.rememberMaxAge;
      const maxAge = typeof remembered === "number" ? remembered : params.maxAge;
      return defaultEncode({ ...params, maxAge });
    },
  },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        remember: { label: "Remember me", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await getUserByEmail(credentials.email.toLowerCase().trim());
        // No passwordHash means an invite is still pending -- the person
        // hasn't set a password yet via /activate, so there's nothing to
        // check credentials against.
        if (!user || !user.passwordHash) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          remember: credentials.remember === "true",
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        const remember = (user as { remember?: boolean }).remember ?? true;
        token.rememberMaxAge = remember ? REMEMBER_MAX_AGE : DEFAULT_MAX_AGE;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};
