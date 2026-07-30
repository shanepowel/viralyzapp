import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const AUTH_COOKIE = "viralyz_session";
const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
    process.env.CLERK_SECRET_KEY?.trim(),
);

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/waitlist(.*)",
  "/claim-invite(.*)",
  "/kit/(.*)",
  "/api/login",
  "/api/logout",
  "/api/signup",
  "/api/auth(.*)",
  "/api/health",
  "/api/waitlist",
  "/api/password-reset(.*)",
  "/api/claim-invite",
  "/api/webhooks/clerk",
  "/api/platforms/oauth/(.*)/callback",
  "/sign-in(.*)",
  "/sign-up(.*)",
]);

function legacyMiddleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/waitlist") ||
    pathname.startsWith("/claim-invite") ||
    pathname.startsWith("/kit/") ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/logout") ||
    pathname.startsWith("/api/signup") ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    pathname === "/api/waitlist" ||
    pathname === "/api/claim-invite" ||
    pathname.startsWith("/api/password-reset") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/uploads/") ||
    pathname === "/favicon.ico" ||
    (pathname.startsWith("/api/platforms/oauth/") && pathname.endsWith("/callback")) ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  const session = req.cookies.get(AUTH_COOKIE)?.value;
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

const withClerk = clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return;
  const { userId } = await auth();
  if (!userId) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
});

export default clerkEnabled ? withClerk : legacyMiddleware;

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
