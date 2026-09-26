// Redirects signed-out visitors to /login (see the `authorized` callback in src/auth.ts).
// Pages and server actions still check permissions themselves; this is only the first gate.
export { auth as proxy } from "@/auth";

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2?)$).*)"],
};
