import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  title: z.string().min(1).max(80),
  overlay: z.string().max(40).optional(),
});

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a title" }, { status: 400 });
  }

  const overlay =
    parsed.data.overlay ||
    parsed.data.title
      .split(/\s+/)
      .slice(0, 3)
      .join(" ")
      .toUpperCase();

  const variants = [
    {
      id: "a",
      overlay,
      gradient: "linear-gradient(135deg,#F2994A,#EB5757)",
      note: "High contrast. Readable at feed size.",
      score: 88,
    },
    {
      id: "b",
      overlay: overlay.split(" ").slice(0, 2).join(" "),
      gradient: "linear-gradient(135deg,#6C4CF1,#3D2A9E)",
      note: "Brand violet frame. Face left, text right.",
      score: 84,
    },
    {
      id: "c",
      overlay: `${overlay}!`,
      gradient: "linear-gradient(135deg,#27AE60,#145A32)",
      note: "Warm market tones. Keep text under three words.",
      score: 81,
    },
  ];

  await prisma.toolRun.create({
    data: {
      userId: auth.session.userId,
      tool: "thumbnails",
      input: parsed.data,
      output: { variants },
    },
  });

  return NextResponse.json({ variants });
}
