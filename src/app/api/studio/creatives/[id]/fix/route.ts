import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { rewriteWording, undoRewrite, type FixError } from "@/lib/fix";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({ action: z.enum(["rewrite", "undo"]) });

const STATUS: Record<FixError, number> = {
  not_found: 404,
  not_ready: 409,
  nothing_to_fix: 409,
  nothing_to_undo: 409,
  rewrite_limit: 429,
  unavailable: 503,
  background_missing: 409,
};

/** Rewrites the wording of a marked ad over the same image, or undoes the last rewrite. Spends no credit. */
export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { id } = await params;
  let result: Awaited<ReturnType<typeof rewriteWording>>;
  try {
    result =
      parsed.data.action === "rewrite"
        ? await rewriteWording(id, auth.session.userId)
        : await undoRewrite(id, auth.session.userId);
  } catch (err) {
    console.error("[studio/fix]", err);
    return NextResponse.json({ error: "fix_failed" }, { status: 502 });
  }
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: STATUS[result.error] });

  const creative = await prisma.creative.findFirst({
    where: { id, userId: auth.session.userId },
    include: { checks: { orderBy: { computedAt: "desc" }, take: 1 } },
  });
  const checks = await prisma.check.count({ where: { creativeId: id } });
  return NextResponse.json({ creative, checks });
}
