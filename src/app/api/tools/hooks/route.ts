import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { generateHooks } from "@/lib/scorer";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ idea: z.string().min(2).max(200) });

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter an idea" }, { status: 400 });
  }
  const hooks = generateHooks(parsed.data.idea);
  await prisma.toolRun.create({
    data: {
      userId: auth.session.userId,
      tool: "hooks",
      input: { idea: parsed.data.idea },
      output: { hooks },
    },
  });
  return NextResponse.json({ hooks });
}
