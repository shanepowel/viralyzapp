import { NextResponse } from "next/server";
import {
  consumeOAuthState,
  exchangeCode,
  type OAuthProvider,
  OAUTH_PROVIDERS,
} from "@/lib/oauth";
import { appUrl } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ provider: string }> };

function parseProvider(raw: string): OAuthProvider | null {
  return OAUTH_PROVIDERS.includes(raw as OAuthProvider) ? (raw as OAuthProvider) : null;
}

function redirectHome(query: Record<string, string>) {
  const url = new URL("/", appUrl());
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return NextResponse.redirect(url);
}

export async function GET(req: Request, { params }: Params) {
  const { provider: raw } = await params;
  const provider = parseProvider(raw);
  if (!provider) {
    return redirectHome({ connect: "error", reason: "unknown_provider" });
  }

  const { searchParams } = new URL(req.url);
  const err = searchParams.get("error");
  if (err) {
    return redirectHome({
      connect: "error",
      provider,
      reason: searchParams.get("error_description") || err,
    });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  if (!code || !state) {
    return redirectHome({ connect: "error", provider, reason: "missing_code" });
  }

  const verified = await consumeOAuthState(provider, state);
  if (!verified) {
    return redirectHome({ connect: "error", provider, reason: "invalid_state" });
  }

  try {
    const tokens = await exchangeCode(provider, code);
    const expiresAt =
      tokens.expiresIn != null
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : null;

    await prisma.platform.upsert({
      where: {
        userId_provider_handle: {
          userId: verified.userId,
          provider,
          handle: tokens.handle,
        },
      },
      create: {
        userId: verified.userId,
        provider,
        handle: tokens.handle,
        externalAccountId: tokens.externalAccountId ?? null,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: expiresAt,
        scopes: tokens.scopes ?? null,
        syncStatus: "ok",
      },
      update: {
        externalAccountId: tokens.externalAccountId ?? null,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken ?? null,
        tokenExpiresAt: expiresAt,
        scopes: tokens.scopes ?? null,
        syncStatus: "ok",
        connectedAt: new Date(),
      },
    });

    return redirectHome({ connect: "ok", provider, handle: tokens.handle });
  } catch (e) {
    const reason = e instanceof Error ? e.message : "oauth_failed";
    return redirectHome({ connect: "error", provider, reason });
  }
}
