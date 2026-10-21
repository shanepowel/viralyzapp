import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const productSchema = z.object({
  title: z.string().min(1),
  price: z.string().optional(),
  currency: z.string().optional(),
  imageUrls: z.array(z.string().url()).min(1, "At least one product image is required"),
  url: z.string().optional(),
});

const bodySchema = z.object({
  name: z.string().min(1),
  sourceUrl: z.string().url().optional(),
  colors: z.array(z.string()).default([]),
  voice: z.string().optional(),
  logoUrl: z.string().optional(),
  product: productSchema,
});

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const brand = await prisma.brand.findUnique({
    where: { userId: auth.session.userId },
    include: { products: true },
  });
  return NextResponse.json({ brand });
}

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid brand payload" },
      { status: 400 },
    );
  }

  const { product, ...brandFields } = parsed.data;

  // Each brand has exactly one product in this flow (resubmitting the setup
  // screen edits the same product rather than adding another one), so a
  // resubmission must update the existing row instead of always creating a
  // new one under the upserted brand.
  const brand = await prisma.$transaction(async (tx) => {
    const existing = await tx.brand.findUnique({
      where: { userId: auth.session.userId },
      include: { products: true },
    });

    if (!existing) {
      return tx.brand.create({
        data: {
          userId: auth.session.userId,
          name: brandFields.name,
          sourceUrl: brandFields.sourceUrl,
          colors: brandFields.colors,
          voice: brandFields.voice,
          logoUrl: brandFields.logoUrl,
          confirmedAt: new Date(),
          products: { create: product },
        },
        include: { products: true },
      });
    }

    await tx.brand.update({
      where: { id: existing.id },
      data: {
        name: brandFields.name,
        sourceUrl: brandFields.sourceUrl,
        colors: brandFields.colors,
        voice: brandFields.voice,
        logoUrl: brandFields.logoUrl,
        confirmedAt: new Date(),
      },
    });

    const existingProduct = existing.products[0];
    if (existingProduct) {
      await tx.product.update({ where: { id: existingProduct.id }, data: product });
    } else {
      await tx.product.create({ data: { ...product, brandId: existing.id } });
    }

    return tx.brand.findUniqueOrThrow({
      where: { id: existing.id },
      include: { products: true },
    });
  });

  return NextResponse.json({ brand });
}
