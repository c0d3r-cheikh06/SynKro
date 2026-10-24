import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy convention (`src/proxy.ts`).
 * Applies strict security headers and performs fast optimistic session-cookie checks
 * for protected route prefixes (`/dashboard`, `/profile`, `/retro`, `/admin`).
 * Full database authorization is enforced server-side in each page, Server Action, and Route Handler.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const hasSessionCookie =
    request.cookies.has("authjs.session-token") ||
    request.cookies.has("__Secure-authjs.session-token") ||
    request.cookies.has("next-auth.session-token");

  const isProtectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/complete-profile") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/retro") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/account-status");

  if (isProtectedPath && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // First-time visitor cinematic introduction flow (/intro)
  // Non-authenticated first-time visitors to the root landing page are presented with Kora's intro.
  // Subsequent navigation or authenticated visits bypass the intro seamlessly.
  const hasIntroSeenCookie = request.cookies.has("synkro_intro_seen");
  const skipIntroQuery = request.nextUrl.searchParams.has("skipIntro");

  if (
    pathname === "/" &&
    !hasSessionCookie &&
    !hasIntroSeenCookie &&
    !skipIntroQuery
  ) {
    const introUrl = new URL("/intro", request.url);
    return NextResponse.redirect(introUrl);
  }

  const response = NextResponse.next();

  // Security headers (Defense-in-Depth)
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(self), microphone=(), geolocation=()"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|avatars/|uploads/|.*\\.svg$).*)",
  ],
};
