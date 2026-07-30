import { NextResponse } from "next/server";
import { z } from "zod";
import { sendPasswordResetEmail } from "@/lib/email";
import { hashToken, rawToken } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit({ key: `pwreset:${ip}`, limit: 8, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many reset requests. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  // Always return ok to avoid email enumeration
  if (!user?.passwordHash) {
    return NextResponse.json({ ok: true });
  }

  const token = rawToken();
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const sent = await sendPasswordResetEmail({ to: email, token });
  return NextResponse.json({
    ok: true,
    ...(sent.mocked && "link" in sent ? { devLink: sent.link } : {}),
  });
}
