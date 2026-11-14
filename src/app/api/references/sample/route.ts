import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getSampleReference, sampleSourceRef } from "@/lib/samples";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ id: z.string().min(1) });

/**
 * Saves one of the built-in sample ads as the caller's own reference, so it
 * can be used in Studio like any other. Using the same sample twice returns
 * the same row.
 */
export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  const sample = parsed.success ? getSampleReference(parsed.data.id) : undefined;
  if (!sample) return NextResponse.json({ error: "Unknown sample" }, { status: 404 });

  const where = { userId: auth.session.userId, source: "user_upload", sourceRef: sampleSourceRef(sample.id) };
  const reference =
    (await prisma.reference.findFirst({ where })) ??
    (await prisma.reference.create({
      data: {
        ...where,
        advertiser: `${sample.advertiser} (sample)`,
        format: sample.format,
        thumbnailUrl: sample.image,
        structure: { ...sample.structure, model: "sample" } as Prisma.InputJsonValue,
      },
    }));
  return NextResponse.json({ reference });
}
