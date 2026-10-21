import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { listReferences, saveUserReference } from "@/lib/references";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ url: z.string().url() });

export async function GET(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const params = new URL(req.url).searchParams;
  const minDaysRunningRaw = params.get("minDaysRunning");
  const minDaysRunning = minDaysRunningRaw ? Number(minDaysRunningRaw) : undefined;
  if (minDaysRunningRaw && !Number.isFinite(minDaysRunning)) {
    return NextResponse.json({ error: "minDaysRunning must be a number" }, { status: 400 });
  }

  const result = await listReferences({
    category: params.get("category") ?? undefined,
    source: params.get("source") ?? undefined,
    minDaysRunning,
    cursor: params.get("cursor") ?? undefined,
  });
  return NextResponse.json(result);
}

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid url is required" }, { status: 400 });
  }

  const reference = await saveUserReference(auth.session.userId, { url: parsed.data.url });
  return NextResponse.json({ reference });
}
