import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { isLimited, recordFailure, resetLimit } from "@/lib/rate-limit";

const WINDOW = 15 * 60_000;

export class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}

const credentialsSchema = z.object({
  email: z.email().transform((e) => e.toLowerCase().trim()),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  logger: {
    // A wrong password is a normal event, not a server error.
    error(error) {
      if ((error as { type?: string }).type !== "CredentialsSignin") console.error(error);
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        // After 5 failed attempts for an email, block it for 15 minutes.
        const key = `login:${parsed.data.email}`;
        if (isLimited(key, 5, WINDOW)) throw new TooManyAttempts();
        const user = await db.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || !user.active || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
          recordFailure(key, WINDOW);
          return null;
        }
        resetLimit(key);
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
    // Used by src/proxy.ts to gate every page.
    authorized({ auth, request }) {
      const isLogin = request.nextUrl.pathname.startsWith("/login");
      if (isLogin) {
        return auth?.user ? Response.redirect(new URL("/", request.nextUrl)) : true;
      }
      return !!auth?.user;
    },
  },
});
