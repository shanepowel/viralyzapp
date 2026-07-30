import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export function generateInviteCode() {
  return randomBytes(4).toString("hex").toUpperCase();
}

export async function consumeInvite(code: string, email: string) {
  const invite = await prisma.invite.findUnique({ where: { code: code.toUpperCase() } });
  if (!invite) return { ok: false as const, error: "Invalid invite code." };
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, error: "That invite code has expired." };
  }
  if (invite.usedCount >= invite.maxUses) {
    return { ok: false as const, error: "That invite code has already been used." };
  }
  if (invite.email && invite.email.toLowerCase() !== email.toLowerCase()) {
    return { ok: false as const, error: "That invite is locked to a different email." };
  }

  await prisma.invite.update({
    where: { id: invite.id },
    data: { usedCount: { increment: 1 } },
  });
  return { ok: true as const, invite };
}

export async function createInvites(opts: {
  count: number;
  maxUses?: number;
  email?: string;
  createdBy?: string;
  note?: string;
  expiresInDays?: number;
}) {
  const expiresAt =
    opts.expiresInDays != null
      ? new Date(Date.now() + opts.expiresInDays * 86400000)
      : null;
  const codes: string[] = [];
  for (let i = 0; i < opts.count; i++) {
    let code = generateInviteCode();
    // rare collision retry
    for (let t = 0; t < 3; t++) {
      const exists = await prisma.invite.findUnique({ where: { code } });
      if (!exists) break;
      code = generateInviteCode();
    }
    await prisma.invite.create({
      data: {
        code,
        email: opts.email?.toLowerCase() ?? null,
        maxUses: opts.maxUses ?? 1,
        createdBy: opts.createdBy,
        note: opts.note,
        expiresAt,
      },
    });
    codes.push(code);
  }
  return codes;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function rawToken() {
  return randomBytes(32).toString("hex");
}
