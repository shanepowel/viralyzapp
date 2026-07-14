import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  provider: z.enum(["tiktok", "instagram", "youtube"]),
  handle: z.string().min(1).max(64).optional(),
});

/** Mock OAuth complete — creates/updates a Platform row for the session user. */
export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const handle =
      parsed.data.handle ??
      `@${auth.session.name.replace(/\s+/g, "").toLowerCase()}`;

    const platform = await prisma.platform.upsert({
      where: {
        userId_provider_handle: {
          userId: auth.session.userId,
          provider: parsed.data.provider,
          handle,
        },
      },
      create: {
        userId: auth.session.userId,
        provider: parsed.data.provider,
        handle,
        syncStatus: "ok",
      },
      update: {
        syncStatus: "ok",
        connectedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      platform,
      message: `Connected ${parsed.data.provider} as ${handle} (mock OAuth).`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to connect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const platforms = await prisma.platform.findMany({
    where: { userId: auth.session.userId },
    orderBy: { connectedAt: "desc" },
  });
  return NextResponse.json({ platforms });
}
