import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = "viralyz_session";

const PUBLIC_PREFIXES = [
  "/login",
  "/kit/",
  "/api/login",
  "/api/logout",
  "/api/signup",
  "/api/auth/",
  "/_next/",
  "/favicon.ico",
  "/uploads/",
];

function isPublic(pathname: string) {
  if (pathname === "/kit" || pathname.startsWith("/kit/")) return true;
  if (pathname === "/api/login" || pathname === "/api/logout" || pathname === "/api/signup") {
    return true;
  }
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Allow static assets in public/
  if (/\.(svg|png|jpg|jpeg|gif|webp|ico)$/.test(pathname)) {
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

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
