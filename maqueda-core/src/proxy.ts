/**
 * Edge proxy (Next 16 name for middleware): cheap cookie presence check that redirects
 * anonymous visitors away from /admin and signed-in users away from /auth.
 * Real session validation happens in lib/auth.ts on the server.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/admin"];
const AUTH_PREFIXES = ["/auth/login"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get("session"));

  if (!hasSession && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }
  if (hasSession && AUTH_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except API routes, static assets and the favicon.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
