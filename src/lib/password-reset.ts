import { hasResend } from "@/lib/env";

/**
 * A reset link may only be minted when it can be delivered, or on a local
 * machine where the sign-in screen shows it. Production without email must
 * not create a token: the previous response put that link in the JSON body.
 */
export function passwordResetDeliveryEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  emailConfigured = hasResend(),
): boolean {
  return nodeEnv !== "production" || emailConfigured;
}

/** Local sign-in can show the link. Production responses stay { ok: true }. */
export function passwordResetBody(input: {
  mocked: boolean;
  link?: string;
  nodeEnv?: string;
}): { ok: true; devLink?: string } {
  const nodeEnv = input.nodeEnv ?? process.env.NODE_ENV;
  if (nodeEnv !== "production" && input.mocked && input.link) {
    return { ok: true, devLink: input.link };
  }
  return { ok: true };
}
