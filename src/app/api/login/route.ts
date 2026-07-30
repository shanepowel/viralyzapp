import { NextResponse } from "next/server";
import { handleLogin } from "@/lib/auth-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * viralyz.com "Sign in" links to /api/login as a browser navigation (GET).
 * Redirect to the login page on the same host; JSON clients must use POST.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dest = new URL("/login", url.origin);
  const next = url.searchParams.get("next");
  if (next) dest.searchParams.set("next", next);
  return NextResponse.redirect(dest, 302);
}

export async function POST(req: Request) {
  return handleLogin(req);
}
