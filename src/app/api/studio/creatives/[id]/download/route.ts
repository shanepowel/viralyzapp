import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readStoredObject } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const creative = await prisma.creative.findFirst({
    where: { id, userId: auth.session.userId },
    include: { checks: { orderBy: { computedAt: "desc" }, take: 1 } },
  });
  if (!creative?.compositeKey) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // A failed policy rule holds the download. The Studio hides the button;
  // this makes the link itself refuse too.
  const factors = (creative.checks[0]?.factors ?? []) as Array<{ kind?: string; status?: string; passed?: boolean }>;
  if (Array.isArray(factors) && factors.some((f) => f.kind === "rule" && f.status === "scored" && f.passed === false)) {
    return NextResponse.json({ error: "policy_blocked" }, { status: 409 });
  }

  let bytes: Buffer | null = null;
  try {
    bytes = await readStoredObject(creative.compositeKey);
  } catch {
    bytes = null;
  }
  if (!bytes) {
    if (creative.compositeUrl?.startsWith("https://") || creative.compositeUrl?.startsWith("http://")) {
      return NextResponse.redirect(creative.compositeUrl);
    }
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const safeTag = creative.tag.replace(/[^a-z0-9_]/gi, "") || "creative";
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${safeTag}.png"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
