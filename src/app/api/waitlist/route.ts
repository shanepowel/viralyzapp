import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = await rateLimit({ key: `waitlist:${ip}`, limit: 8, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many submissions. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json(
      { error: "That email already has an account. Sign in instead." },
      { status: 409 },
    );
  }

  await prisma.waitlistEntry.upsert({
    where: { email },
    create: {
      email,
      name: parsed.data.name ?? null,
      status: "pending",
    },
    update: {
      name: parsed.data.name ?? undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
