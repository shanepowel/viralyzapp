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

export function oauthSecret() {
  return (
    process.env.OAUTH_STATE_SECRET ||
    process.env.SESSION_SECRET ||
    "viralyz-dev-oauth-secret-change-me"
  );
}

export function resendFrom() {
  return process.env.RESEND_FROM || "Viralyz <onboarding@resend.dev>";
}

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "maya@viralyz.com")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string) {
  return adminEmails().includes(email.toLowerCase());
}
