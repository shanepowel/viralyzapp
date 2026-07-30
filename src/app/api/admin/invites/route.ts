import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { sendInviteEmail } from "@/lib/email";
import { createInvites } from "@/lib/invites";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  count: z.number().int().min(1).max(50).default(1),
  email: z.string().email().optional(),
  note: z.string().max(200).optional(),
  maxUses: z.number().int().min(1).max(100).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
  sendEmail: z.boolean().optional(),
});

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ invites });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid invite payload." }, { status: 400 });
  }

  const codes = await createInvites({
    count: parsed.data.count,
    email: parsed.data.email,
    note: parsed.data.note,
    maxUses: parsed.data.maxUses,
    expiresInDays: parsed.data.expiresInDays,
    createdBy: auth.user.id,
  });

  if (parsed.data.sendEmail && parsed.data.email) {
    for (const code of codes) {
      await sendInviteEmail({ to: parsed.data.email, code });
    }
  }

  return NextResponse.json({ ok: true, codes });
}
