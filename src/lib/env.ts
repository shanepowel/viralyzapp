/** Shared env helpers for optional production adapters. */

export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
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
