import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().min(1).max(160),
  durationSec: z.number().int().min(5).max(3600).default(42),
  platform: z.enum(["tiktok", "instagram", "youtube"]).optional(),
  sourceUrl: z.string().url().optional().or(z.literal("")),
  thumbnailUrl: z.string().optional(),
});

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const items = await prisma.content.findMany({
    where: { userId: auth.session.userId },
    include: {
      platform: true,
      versions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
        include: { score: true },
      },
      performance: { orderBy: { measuredAt: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    items: items.map((c) => ({
      id: c.id,
      title: c.title,
      status: c.status,
      durationSec: c.durationSec,
      thumbnailUrl: c.thumbnailUrl,
      platform: c.platform?.provider ?? null,
      score: c.versions[0]?.score?.overallScore ?? null,
      scheduledFor: c.scheduledFor?.toISOString() ?? null,
      postedAt: c.postedAt?.toISOString() ?? null,
      actualViews: c.performance[0]?.actualViews ?? null,
      predictedViewsLow: c.versions[0]?.score?.predictedViewsLow ?? null,
      predictedViewsHigh: c.versions[0]?.score?.predictedViewsHigh ?? null,
    })),
  });
}

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid content payload" }, { status: 400 });
    }

    let platformId: string | undefined;
    if (parsed.data.platform) {
      const platform = await prisma.platform.findFirst({
        where: { userId: auth.session.userId, provider: parsed.data.platform },
      });
      if (platform) platformId = platform.id;
      else {
        const created = await prisma.platform.create({
          data: {
            userId: auth.session.userId,
            provider: parsed.data.platform,
            handle: `@${auth.session.name.replace(/\s+/g, "").toLowerCase()}`,
          },
        });
        platformId = created.id;
      }
    }

    const gradients = [
      "linear-gradient(135deg,#F2994A,#EB5757)",
      "linear-gradient(135deg,#6C4CF1,#3D2A9E)",
      "linear-gradient(135deg,#56CCF2,#2F80ED)",
      "linear-gradient(135deg,#27AE60,#145A32)",
    ];

    const content = await prisma.content.create({
      data: {
        userId: auth.session.userId,
        platformId,
        title: parsed.data.title,
        durationSec: parsed.data.durationSec,
        sourceUrl: parsed.data.sourceUrl || null,
        thumbnailUrl:
          parsed.data.thumbnailUrl ??
          gradients[Math.floor(Math.random() * gradients.length)],
        status: "draft",
      },
    });

    return NextResponse.json({ id: content.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create content";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
