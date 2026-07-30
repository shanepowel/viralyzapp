import { NextResponse } from "next/server";
import { handleLogin } from "@/lib/auth-handlers";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * viralyz.com "Sign in" links to /api/login as a browser navigation (GET).
 * Redirect to the login page; JSON clients must use POST.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const dest = new URL("/login", appUrl());
  if (next) dest.searchParams.set("next", next);
  return NextResponse.redirect(dest, 302);
}

export async function POST(req: Request) {
  return handleLogin(req);
}
