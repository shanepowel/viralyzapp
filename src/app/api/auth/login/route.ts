import { NextResponse } from "next/server";
import { handleLogin } from "@/lib/auth-handlers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** @deprecated Prefer /api/login — GET redirects for marketing-site Sign in links */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const dest = new URL("/login", url.origin);
  const next = url.searchParams.get("next");
  if (next) dest.searchParams.set("next", next);
  return NextResponse.redirect(dest, 302);
}

/** @deprecated Prefer POST /api/login */
export async function POST(req: Request) {
  return handleLogin(req);
}
