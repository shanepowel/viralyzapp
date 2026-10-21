import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { adjust, balance } from "@/lib/credits";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  delta: z
    .number()
    .int()
    .refine((v) => v !== 0, "delta must be nonzero")
    .optional(),
  note: z.string().optional(),
  plan: z.enum(["credits", "unlimited"]).optional(),
  role: z.enum(["user", "admin"]).optional(),
});

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid credits payload." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (parsed.data.delta != null) {
    await adjust(user.id, parsed.data.delta, parsed.data.note ?? "admin adjustment");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.plan ? { plan: parsed.data.plan } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
    },
    select: { id: true, email: true, plan: true, role: true },
  });

  return NextResponse.json({ ok: true, user: { ...updated, balance: await balance(updated.id) } });
}

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      plan: true,
      role: true,
      createdAt: true,
      onboardingDone: true,
    },
  });

  const sums = await prisma.creditLedger.groupBy({
    by: ["userId"],
    where: { userId: { in: users.map((u) => u.id) } },
    _sum: { delta: true },
  });
  const balanceByUser = new Map(sums.map((s) => [s.userId, s._sum.delta ?? 0]));

  return NextResponse.json({
    users: users.map((u) => ({ ...u, balance: balanceByUser.get(u.id) ?? 0 })),
  });
}
