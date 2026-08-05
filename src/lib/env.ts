/** Feature flags / env helpers for scale + SSO. */

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function isClerkEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim() &&
      process.env.CLERK_SECRET_KEY?.trim(),
  );
}

export function isInviteOnly() {
  const v = (process.env.INVITE_ONLY || "true").toLowerCase();
  return v !== "false" && v !== "0";
}

export function hasResend() {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function hasRedis() {
  return Boolean(process.env.REDIS_URL?.trim());
}

export function hasS3() {
  return Boolean(
    process.env.S3_BUCKET?.trim() &&
      process.env.S3_ACCESS_KEY?.trim() &&
      process.env.S3_SECRET_KEY?.trim(),
  );
}

export function hasScoringService() {
  return Boolean(process.env.SCORING_SERVICE_URL?.trim());
}

const DEFAULT_OAUTH_SECRET = "viralyz-dev-oauth-secret-change-me";

export function oauthSecret() {
  const secret = process.env.OAUTH_STATE_SECRET?.trim() || process.env.SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "OAUTH_STATE_SECRET is not set. Refusing to sign OAuth state with a default secret in production.",
    );
  }
  return DEFAULT_OAUTH_SECRET;
}

/**
 * Fail fast at boot rather than silently signing with a public default.
 * Called from instrumentation.ts.
 */
export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== "production") return;

  const missing: string[] = [];
  const weak: string[] = [];

  const session = process.env.SESSION_SECRET?.trim() || process.env.OAUTH_STATE_SECRET?.trim();
  const oauth = process.env.OAUTH_STATE_SECRET?.trim() || process.env.SESSION_SECRET?.trim();

  if (!session) missing.push("SESSION_SECRET");
  if (!oauth) missing.push("OAUTH_STATE_SECRET");

  for (const [name, value] of [
    ["SESSION_SECRET", session],
    ["OAUTH_STATE_SECRET", oauth],
  ] as const) {
    if (!value) continue;
    if (value === DEFAULT_OAUTH_SECRET || value === "change-me-in-production") {
      weak.push(`${name} is set to a known placeholder`);
    } else if (value.length < 32) {
      weak.push(`${name} is shorter than 32 characters`);
    }
  }

  if (missing.length || weak.length) {
    throw new Error(
      [
        "Refusing to start in production with unsafe secrets.",
        missing.length ? `Missing: ${missing.join(", ")}.` : "",
        weak.length ? `Weak: ${weak.join("; ")}.` : "",
        "Generate with: openssl rand -base64 48",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
}

/** One-click demo sign-in. Off unless explicitly enabled. */
export function isDemoLoginEnabled() {
  const v = (process.env.DEMO_LOGIN || "false").toLowerCase();
  return v === "true" || v === "1";
}

export function demoLoginEmail() {
  return (process.env.DEMO_LOGIN_EMAIL || "demo@viralyz.com").trim().toLowerCase();
}

export function resendFrom() {
  return process.env.RESEND_FROM || "Viralyz <onboarding@resend.dev>";
}

/**
 * Emails auto-granted admin on SSO link/create. Empty by default — previously this
 * fell back to a demo address, which silently granted admin to anyone who could
 * authenticate as it.
 */
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(email.toLowerCase());
}
