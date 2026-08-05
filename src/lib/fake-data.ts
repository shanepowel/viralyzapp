/**
 * Guard for illustrative/seeded data. Any value a user could mistake for a real
 * measurement must be gated on this. Hard-off in production.
 */
export function allowFakeData(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return (process.env.ALLOW_FAKE_DATA || "false").toLowerCase() === "true";
}
