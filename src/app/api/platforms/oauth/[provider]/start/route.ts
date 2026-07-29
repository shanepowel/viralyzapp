import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";
import { requireApiSession } from "@/lib/api";
import {
  buildAuthorizeUrl,
  isOAuthConfigured,
  type OAuthProvider,
  OAUTH_PROVIDERS,
} from "@/lib/oauth";
import { oauthSecret } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ provider: string }> };

const STATE_COOKIE = "viralyz_oauth_state";

function parseProvider(raw: string): OAuthProvider | null {
  return OAUTH_PROVIDERS.includes(raw as OAuthProvider) ? (raw as OAuthProvider) : null;
}

/** Kick off real OAuth when credentials exist; otherwise tell the client to use mock connect. */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const { provider: raw } = await params;
  const provider = parseProvider(raw);
  if (!provider) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 400 });
  }

  if (!isOAuthConfigured(provider)) {
    return NextResponse.json({
      configured: false,
      provider,
      message: `${provider} OAuth credentials are not set. Use POST /api/platforms/connect for mock connect.`,
    });
  }

  const nonce = randomBytes(16).toString("hex");
  const payload = `${provider}.${auth.session.userId}.${nonce}.${Date.now()}`;
  const signature = createHmac("sha256", oauthSecret()).update(payload).digest("hex");
  const stateValue = `${payload}.${signature}`;

  const url = buildAuthorizeUrl(provider, nonce);
  if (!url) {
    return NextResponse.json({ error: "Could not build authorize URL" }, { status: 500 });
  }

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, stateValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return res;
}
