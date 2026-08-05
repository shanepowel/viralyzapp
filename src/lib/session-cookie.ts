/**
 * Tamper-proof session cookie.
 *
 * The cookie value is `base64url(JSON payload).base64url(HMAC-SHA256)`. Any edit to
 * the payload invalidates the signature, so a client cannot mint a session for an
 * arbitrary userId. Uses Web Crypto so the same code runs in Edge middleware and in
 * Node route handlers.
 *
 * SECURITY: this module must not import anything that pulls in Prisma or Clerk —
 * it has to stay Edge-safe.
 */

const ALG = { name: "HMAC", hash: "SHA-256" } as const;

/** Max session age, enforced server-side. Cookie maxAge alone is client-controlled. */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14;

export type SessionPayload = {
  userId: string;
  email: string;
  name: string;
  /** Issued-at, epoch seconds. */
  iat: number;
};

const DEFAULT_DEV_SECRET = "viralyz-dev-session-secret-change-me";

/**
 * Session signing secret. Falls back to a well-known dev value outside production;
 * `assertProductionSecrets()` makes that fatal in production.
 */
export function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim() || process.env.OAUTH_STATE_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET is not set. Refusing to sign sessions with a default secret in production.",
    );
  }
  return DEFAULT_DEV_SECRET;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    ALG,
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: string): Promise<string> {
  const sig = await crypto.subtle.sign(
    ALG.name,
    await key(),
    new TextEncoder().encode(payload),
  );
  return b64urlEncode(new Uint8Array(sig));
}

/** Serialize + sign. Returns the value to store in the cookie. */
export async function serializeSession(
  user: Pick<SessionPayload, "userId" | "email" | "name">,
): Promise<string> {
  const payload: SessionPayload = {
    userId: user.userId,
    email: user.email,
    name: user.name,
    iat: Math.floor(Date.now() / 1000),
  };
  const encoded = b64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  return `${encoded}.${await sign(encoded)}`;
}

/**
 * Verify + parse. Returns null for any tampered, malformed, or expired value.
 * Verification is constant-time via crypto.subtle.verify.
 */
export async function parseSession(raw: string | undefined | null): Promise<SessionPayload | null> {
  if (!raw) return null;

  const sep = raw.lastIndexOf(".");
  if (sep <= 0) return null;

  const encoded = raw.slice(0, sep);
  const signature = raw.slice(sep + 1);

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      ALG.name,
      await key(),
      b64urlDecode(signature),
      new TextEncoder().encode(encoded),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(encoded))) as SessionPayload;
  } catch {
    return null;
  }

  if (
    typeof payload?.userId !== "string" ||
    typeof payload?.email !== "string" ||
    typeof payload?.name !== "string" ||
    typeof payload?.iat !== "number"
  ) {
    return null;
  }

  const age = Math.floor(Date.now() / 1000) - payload.iat;
  if (age < 0 || age > SESSION_MAX_AGE_SEC) return null;

  return payload;
}

/** Shared cookie attributes. */
export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax",
  path: "/",
  maxAge: SESSION_MAX_AGE_SEC,
  secure: process.env.NODE_ENV === "production",
} as const;
