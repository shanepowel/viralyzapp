import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const comments = await prisma.engageComment.findMany({
    where: { userId: auth.session.userId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ comments });
}

const replySchema = z.object({
  id: z.string(),
  reply: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const parsed = replySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid reply" }, { status: 400 });
  }
  const existing = await prisma.engageComment.findFirst({
    where: { id: parsed.data.id, userId: auth.session.userId },
  });
  if (!existing) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }
  const comment = await prisma.engageComment.update({
    where: { id: parsed.data.id },
    data: { reply: parsed.data.reply, repliedAt: new Date() },
  });
  return NextResponse.json({ comment });
}
