import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  creditsRemaining: z.number().int().min(0).max(100000).optional(),
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

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(parsed.data.creditsRemaining != null
        ? { creditsRemaining: parsed.data.creditsRemaining }
        : {}),
      ...(parsed.data.plan ? { plan: parsed.data.plan } : {}),
      ...(parsed.data.role ? { role: parsed.data.role } : {}),
    },
    select: {
      id: true,
      email: true,
      plan: true,
      creditsRemaining: true,
      role: true,
    },
  });

  return NextResponse.json({ ok: true, user: updated });
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
      creditsRemaining: true,
      role: true,
      createdAt: true,
      onboardingDone: true,
    },
  });
  return NextResponse.json({ users });
}
