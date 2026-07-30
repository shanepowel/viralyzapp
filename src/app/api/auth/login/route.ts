import { NextResponse } from "next/server";
import { handleLogin } from "@/lib/auth-handlers";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** @deprecated Prefer /api/login — GET redirects for marketing-site Sign in links */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const next = url.searchParams.get("next");
  const dest = new URL("/login", appUrl());
  if (next) dest.searchParams.set("next", next);
  return NextResponse.redirect(dest, 302);
}

/** @deprecated Prefer POST /api/login */
export async function POST(req: Request) {
  return handleLogin(req);
}
