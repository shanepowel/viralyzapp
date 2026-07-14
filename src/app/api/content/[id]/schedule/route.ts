import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  scheduledFor: z.string().datetime().optional(),
});

export async function POST(req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);

    const scheduledFor = parsed.success && parsed.data.scheduledFor
      ? new Date(parsed.data.scheduledFor)
      : (() => {
          const d = new Date();
          d.setHours(18, 0, 0, 0);
          if (d.getTime() < Date.now()) {
            d.setDate(d.getDate() + 1);
          }
          return d;
        })();

    const content = await prisma.content.update({
      where: { id },
      data: {
        status: "scheduled",
        scheduledFor,
      },
    });

    return NextResponse.json({
      id: content.id,
      status: content.status,
      scheduledFor: content.scheduledFor?.toISOString() ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to schedule";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
