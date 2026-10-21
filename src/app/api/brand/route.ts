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

  const brand = await prisma.brand.upsert({
    where: { userId: auth.session.userId },
    create: {
      userId: auth.session.userId,
      name: brandFields.name,
      sourceUrl: brandFields.sourceUrl,
      colors: brandFields.colors,
      voice: brandFields.voice,
      logoUrl: brandFields.logoUrl,
      confirmedAt: new Date(),
      products: { create: product },
    },
    update: {
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

  return NextResponse.json({ brand });
}
