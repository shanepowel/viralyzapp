import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Inline image for a file stored in Postgres. Same-origin, so the session cookie is sent. */
export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const row = await prisma.storedFile.findFirst({
    where: { id, userId: auth.session.userId },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(row.bytes), {
    headers: {
      "Content-Type": row.contentType || "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
