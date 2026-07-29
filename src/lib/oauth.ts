import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { appUrl, oauthSecret } from "@/lib/env";

export type OAuthProvider = "tiktok" | "instagram" | "youtube";

export const OAUTH_PROVIDERS: OAuthProvider[] = ["tiktok", "instagram", "youtube"];

const STATE_COOKIE = "viralyz_oauth_state";

type ProviderConfig = {
  clientId: string;
  clientSecret: string;
  authUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthParams?: Record<string, string>;
};

export function getProviderConfig(provider: OAuthProvider): ProviderConfig | null {
  switch (provider) {
    case "tiktok": {
      const clientId = process.env.TIKTOK_CLIENT_ID?.trim();
      const clientSecret = process.env.TIKTOK_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) return null;
      return {
        clientId,
        clientSecret,
        authUrl: "https://www.tiktok.com/v2/auth/authorize/",
        tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
        scopes: ["user.info.basic"],
      };
    }
    case "instagram": {
      const clientId = process.env.INSTAGRAM_CLIENT_ID?.trim();
      const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) return null;
      return {
        clientId,
        clientSecret,
        authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
        tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
        scopes: ["instagram_basic", "pages_show_list", "pages_read_engagement"],
      };
    }
    case "youtube": {
      const clientId = process.env.YOUTUBE_CLIENT_ID?.trim();
      const clientSecret = process.env.YOUTUBE_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) return null;
      return {
        clientId,
        clientSecret,
        authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: [
          "openid",
          "email",
          "profile",
          "https://www.googleapis.com/auth/youtube.readonly",
        ],
        extraAuthParams: {
          access_type: "offline",
          prompt: "consent",
          include_granted_scopes: "true",
        },
      };
    }
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

export function isOAuthConfigured(provider: OAuthProvider) {
  return getProviderConfig(provider) !== null;
}

export function oauthCallbackUrl(provider: OAuthProvider) {
  return `${appUrl()}/api/platforms/oauth/${provider}/callback`;
}

function sign(payload: string) {
  return createHmac("sha256", oauthSecret()).update(payload).digest("hex");
}

export async function createOAuthState(provider: OAuthProvider, userId: string) {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${provider}.${userId}.${nonce}.${Date.now()}`;
  const value = `${payload}.${sign(payload)}`;
  const jar = await cookies();
  jar.set(STATE_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  return nonce;
}

export async function consumeOAuthState(
  provider: OAuthProvider,
  nonce: string,
): Promise<{ userId: string } | null> {
  const jar = await cookies();
  const raw = jar.get(STATE_COOKIE)?.value;
  jar.delete(STATE_COOKIE);
  if (!raw) return null;

  const parts = raw.split(".");
  if (parts.length < 5) return null;
  const signature = parts.pop()!;
  const payload = parts.join(".");
  const expected = sign(payload);
  try {
    if (
      signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }
  } catch {
    return null;
  }

  const [p, userId, storedNonce, ts] = payload.split(".");
  if (p !== provider || storedNonce !== nonce || !userId) return null;
  if (Date.now() - Number(ts) > 10 * 60 * 1000) return null;
  return { userId };
}

export function buildAuthorizeUrl(provider: OAuthProvider, state: string): string | null {
  const config = getProviderConfig(provider);
  if (!config) return null;

  const url = new URL(config.authUrl);
  if (provider === "tiktok") {
    url.searchParams.set("client_key", config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scopes.join(","));
    url.searchParams.set("redirect_uri", oauthCallbackUrl(provider));
    url.searchParams.set("state", state);
  } else {
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", config.scopes.join(" "));
    url.searchParams.set("redirect_uri", oauthCallbackUrl(provider));
    url.searchParams.set("state", state);
    for (const [k, v] of Object.entries(config.extraAuthParams ?? {})) {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export type TokenResult = {
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scopes?: string | null;
  handle: string;
  externalAccountId?: string | null;
};

export async function exchangeCode(
  provider: OAuthProvider,
  code: string,
): Promise<TokenResult> {
  const config = getProviderConfig(provider);
  if (!config) throw new Error(`${provider} OAuth is not configured`);

  switch (provider) {
    case "tiktok":
      return exchangeTikTok(config, code);
    case "instagram":
      return exchangeInstagram(config, code);
    case "youtube":
      return exchangeYouTube(config, code);
    default: {
      const _exhaustive: never = provider;
      return _exhaustive;
    }
  }
}

async function exchangeTikTok(config: ProviderConfig, code: string): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_key: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: oauthCallbackUrl("tiktok"),
  });
  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    open_id?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || "TikTok token exchange failed");
  }

  const infoRes = await fetch(
    "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username",
    {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    },
  );
  const infoJson = (await infoRes.json()) as {
    data?: { user?: { open_id?: string; display_name?: string; username?: string } };
  };
  const user = infoJson.data?.user;
  const handle = user?.username
    ? `@${user.username}`
    : user?.display_name
      ? `@${user.display_name.replace(/\s+/g, "").toLowerCase()}`
      : `@tiktok_${(tokenJson.open_id || "user").slice(0, 8)}`;

  return {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresIn: tokenJson.expires_in,
    scopes: tokenJson.scope,
    handle,
    externalAccountId: user?.open_id || tokenJson.open_id,
  };
}

async function exchangeInstagram(config: ProviderConfig, code: string): Promise<TokenResult> {
  const tokenUrl = new URL(config.tokenUrl);
  tokenUrl.searchParams.set("client_id", config.clientId);
  tokenUrl.searchParams.set("client_secret", config.clientSecret);
  tokenUrl.searchParams.set("redirect_uri", oauthCallbackUrl("instagram"));
  tokenUrl.searchParams.set("code", code);

  const tokenRes = await fetch(tokenUrl.toString());
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error?.message || "Instagram token exchange failed");
  }

  const meRes = await fetch(
    `https://graph.facebook.com/v19.0/me?fields=id,name&access_token=${encodeURIComponent(tokenJson.access_token)}`,
  );
  const me = (await meRes.json()) as { id?: string; name?: string; error?: { message?: string } };
  if (!meRes.ok || me.error) {
    throw new Error(me.error?.message || "Instagram profile fetch failed");
  }

  let handle = me.name
    ? `@${me.name.replace(/\s+/g, "").toLowerCase()}`
    : `@ig_${(me.id || "user").slice(0, 8)}`;
  let externalAccountId = me.id ?? null;

  try {
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(tokenJson.access_token)}`,
    );
    const accounts = (await accountsRes.json()) as {
      data?: Array<{
        instagram_business_account?: { id?: string; username?: string };
      }>;
    };
    const ig = accounts.data?.find((a) => a.instagram_business_account)?.instagram_business_account;
    if (ig?.username) {
      handle = `@${ig.username}`;
      externalAccountId = ig.id ?? externalAccountId;
    }
  } catch {
    // Pages/IG linkage optional — fall back to FB profile
  }

  return {
    accessToken: tokenJson.access_token,
    refreshToken: null,
    expiresIn: tokenJson.expires_in,
    scopes: config.scopes.join(","),
    handle,
    externalAccountId,
  };
}

async function exchangeYouTube(config: ProviderConfig, code: string): Promise<TokenResult> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: oauthCallbackUrl("youtube"),
  });
  const tokenRes = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(tokenJson.error_description || tokenJson.error || "YouTube token exchange failed");
  }

  const channelRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
  );
  const channelJson = (await channelRes.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string } }>;
  };
  const channel = channelJson.items?.[0];
  const custom = channel?.snippet?.customUrl;
  const handle = custom
    ? custom.startsWith("@")
      ? custom
      : `@${custom}`
    : channel?.snippet?.title
      ? `@${channel.snippet.title.replace(/\s+/g, "").toLowerCase()}`
      : "@youtube";

  return {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token,
    expiresIn: tokenJson.expires_in,
    scopes: tokenJson.scope,
    handle,
    externalAccountId: channel?.id ?? null,
  };
}
