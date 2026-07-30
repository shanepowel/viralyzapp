import { Resend } from "resend";
import { appUrl, hasResend, resendFrom } from "@/lib/env";

function client() {
  if (!hasResend()) return null;
  return new Resend(process.env.RESEND_API_KEY!);
}

export async function sendInviteEmail(opts: {
  to: string;
  code: string;
  name?: string | null;
}) {
  const resend = client();
  const link = `${appUrl()}/login?mode=signup&invite=${encodeURIComponent(opts.code)}`;
  const subject = "You're invited to Viralyz beta";
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;color:#1B1826;line-height:1.55">
      <h1 style="font-size:22px">You're in.</h1>
      <p>Hi${opts.name ? ` ${opts.name}` : ""}, you have a Viralyz beta invite.</p>
      <p>Invite code: <strong style="font-family:ui-monospace,monospace">${opts.code}</strong></p>
      <p><a href="${link}" style="display:inline-block;background:#6C4CF1;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Create your account</a></p>
      <p style="color:#928FA0;font-size:13px">Or go to ${appUrl()}/login and enter the code.</p>
    </div>
  `;

  if (!resend) {
    console.info("[email:dev] invite", { to: opts.to, code: opts.code, link });
    return { ok: true, mocked: true };
  }

  await resend.emails.send({
    from: resendFrom(),
    to: opts.to,
    subject,
    html,
  });
  return { ok: true, mocked: false };
}

export async function sendPasswordResetEmail(opts: { to: string; token: string }) {
  const resend = client();
  const link = `${appUrl()}/login?reset=${encodeURIComponent(opts.token)}`;
  const subject = "Reset your Viralyz password";
  const html = `
    <div style="font-family:Inter,system-ui,sans-serif;color:#1B1826;line-height:1.55">
      <h1 style="font-size:22px">Reset your password</h1>
      <p>Click below within 60 minutes to choose a new password.</p>
      <p><a href="${link}" style="display:inline-block;background:#6C4CF1;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none;font-weight:600">Reset password</a></p>
      <p style="color:#928FA0;font-size:13px">If you didn't ask for this, you can ignore this email.</p>
    </div>
  `;

  if (!resend) {
    console.info("[email:dev] password-reset", { to: opts.to, link });
    return { ok: true, mocked: true, link };
  }

  await resend.emails.send({
    from: resendFrom(),
    to: opts.to,
    subject,
    html,
  });
  return { ok: true, mocked: false };
}

export async function sendWaitlistApprovedEmail(opts: {
  to: string;
  code: string;
}) {
  return sendInviteEmail({ to: opts.to, code: opts.code });
}
