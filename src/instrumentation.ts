/**
 * Runs once at server startup (Next.js instrumentation hook).
 *
 * Fails the boot rather than letting production run with placeholder signing secrets.
 * A weak SESSION_SECRET means session cookies can be forged; a weak OAUTH_STATE_SECRET
 * means the OAuth state parameter can be forged (CSRF on platform account linking).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertProductionSecrets } = await import("@/lib/env");
  assertProductionSecrets();
}
