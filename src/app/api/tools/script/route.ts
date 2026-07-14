import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { analyzeScript } from "@/lib/scorer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ script: z.string().min(10).max(20000) });

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Paste a longer script" }, { status: 400 });
  }
  const lines = analyzeScript(parsed.data.script);
  const delta = lines.reduce((s, l) => s + l.delta, 0);
  await prisma.toolRun.create({
    data: {
      userId: auth.session.userId,
      tool: "script",
      input: { script: parsed.data.script },
      output: { lines, delta },
    },
  });
  return NextResponse.json({ lines, delta });
}
