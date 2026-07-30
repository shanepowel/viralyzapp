import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { sendWaitlistApprovedEmail } from "@/lib/email";
import { createInvites } from "@/lib/invites";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const approveSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["approve", "reject"]),
});

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const entries = await prisma.waitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ entries });
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = approveSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid waitlist action." }, { status: 400 });
  }

  const entry = await prisma.waitlistEntry.findUnique({ where: { id: parsed.data.id } });
  if (!entry) {
    return NextResponse.json({ error: "Entry not found." }, { status: 404 });
  }

  if (parsed.data.action === "reject") {
    const updated = await prisma.waitlistEntry.update({
      where: { id: entry.id },
      data: { status: "rejected" },
    });
    return NextResponse.json({ ok: true, entry: updated });
  }

  const [code] = await createInvites({
    count: 1,
    email: entry.email,
    note: `Waitlist ${entry.id}`,
    createdBy: auth.user.id,
    expiresInDays: 30,
  });

  const updated = await prisma.waitlistEntry.update({
    where: { id: entry.id },
    data: { status: "approved", inviteCode: code },
  });

  await sendWaitlistApprovedEmail({ to: entry.email, code });

  return NextResponse.json({ ok: true, entry: updated, code });
}
