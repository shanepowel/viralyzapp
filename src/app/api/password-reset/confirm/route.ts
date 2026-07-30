import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { hashToken } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(100),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit({ key: `pwconfirm:${ip}`, limit: 10, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Provide a valid reset token and password (8+ chars)." },
      { status: 400 },
    );
  }

  const tokenHash = hashToken(parsed.data.token);
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) {
    return NextResponse.json({ error: "Reset link is invalid or expired." }, { status: 400 });
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return NextResponse.json({ ok: true });
}
