import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const schema = z.object({
  done: z.boolean(),
});

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: auth.user.id },
    data: { onboardingDone: parsed.data.done },
  });

  return NextResponse.json({ ok: true });
}
