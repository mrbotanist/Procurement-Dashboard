import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { requiresTwoFactor } from "@/lib/auth/two-factor";
import { checkPassword, verifyCode } from "@/server/login";

export class TooManyAttempts extends CredentialsSignin {
  code = "rate_limited";
}
export class CodeRequired extends CredentialsSignin {
  code = "code_required";
}
export class CodeInvalid extends CredentialsSignin {
  code = "code_invalid";
}
export class CodeExpired extends CredentialsSignin {
  code = "code_expired";
}

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
      credentials: { email: {}, password: {}, challengeId: {}, code: {} },
      async authorize(raw) {
        // Second step: the code emailed after the password was checked (src/server/login.ts).
        if (raw.challengeId) {
          const r = await verifyCode(raw.challengeId, raw.code);
          if (r.ok) return r.user;
          if (r.reason === "rate_limited") throw new TooManyAttempts();
          throw r.reason === "invalid" ? new CodeInvalid() : new CodeExpired();
        }
        const r = await checkPassword(raw.email, raw.password);
        if (!r.ok) {
          if (r.reason === "rate_limited") throw new TooManyAttempts();
          return null;
        }
        // A password alone is never enough when this role needs a code, even if the
        // sign-in endpoint is called directly instead of through the login page.
        if (requiresTwoFactor(r.user.role, process.env.TWO_FACTOR)) throw new CodeRequired();
        return r.user;
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
