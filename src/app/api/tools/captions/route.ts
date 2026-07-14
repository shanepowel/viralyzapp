import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateCaptions } from "@/lib/scorer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ topic: z.string().min(2).max(200) });

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a topic" }, { status: 400 });
  }
  const captions = generateCaptions(parsed.data.topic);
  await prisma.toolRun.create({
    data: {
      userId: auth.session.userId,
      tool: "captions",
      input: { topic: parsed.data.topic },
      output: { captions },
    },
  });
  return NextResponse.json({ captions });
}
