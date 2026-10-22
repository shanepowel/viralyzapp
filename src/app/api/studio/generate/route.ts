import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { balance, reserve } from "@/lib/credits";
import { creditPricePerVariant } from "@/lib/env";
import { generationAvailable, processCreativeJob } from "@/lib/generation";
import { PLACEMENTS } from "@/lib/preflight/placements";
import { prisma } from "@/lib/prisma";
import { enqueueStudioJob } from "@/lib/queue";
import { withUniqueTag } from "@/lib/tags";

export const dynamic = "force-dynamic";

const PLACEMENT_IDS = Object.keys(PLACEMENTS) as [keyof typeof PLACEMENTS, ...(keyof typeof PLACEMENTS)[]];

const bodySchema = z.object({
  productId: z.string().min(1),
  referenceId: z.string().min(1).optional(),
  placement: z.enum(PLACEMENT_IDS),
  angles: z.array(z.enum(["offer", "problem", "proof", "demo"])).min(1).max(4),
});

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  // Checked before touching credits or the DB — a request that can't
  // possibly succeed should never reserve anything.
  if (!generationAvailable()) {
    return NextResponse.json({ error: "generation_unavailable" }, { status: 503 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  // No generation without a confirmed Brand (spec §5).
  const product = await prisma.product.findFirst({
    where: {
      id: parsed.data.productId,
      brand: { userId: auth.session.userId, confirmedAt: { not: null } },
    },
  });
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  if (parsed.data.referenceId) {
    const reference = await prisma.reference.findUnique({ where: { id: parsed.data.referenceId } });
    // A Tier 1 (shared) reference has no owner; a Tier 2 one must be ours.
    if (!reference || (reference.userId && reference.userId !== auth.session.userId)) {
      return NextResponse.json({ error: "Reference not found" }, { status: 404 });
    }
  }

  const price = creditPricePerVariant();
  const required = parsed.data.angles.length * price;
  const currentBalance = await balance(auth.session.userId);
  if (currentBalance < required) {
    return NextResponse.json({ error: "insufficient_credits" }, { status: 402 });
  }

  const creativeIds: string[] = [];
  for (const angle of parsed.data.angles) {
    const creative = await withUniqueTag((tag) =>
      prisma.creative.create({
        data: {
          userId: auth.session.userId,
          brandId: product.brandId,
          productId: product.id,
          referenceId: parsed.data.referenceId,
          placement: parsed.data.placement,
          angle,
          tag,
          aiGenerated: true,
          status: "pending",
        },
      }),
    );

    const reserved = await reserve(auth.session.userId, price, creative.id);
    if (!reserved.ok) {
      // The upfront balance check should have ruled this out; if it still
      // happens (a concurrent request), fail this one variant rather than
      // the whole batch.
      await prisma.creative.update({ where: { id: creative.id }, data: { status: "failed" } });
      continue;
    }

    creativeIds.push(creative.id);
    const queued = await enqueueStudioJob(creative.id);
    if (!queued) {
      void processCreativeJob(creative.id);
    }
  }

  return NextResponse.json({ creativeIds });
}
