import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { listReferences, listUserReferences, saveUserReference } from "@/lib/references";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ url: z.string().url() });

export async function GET(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const params = new URL(req.url).searchParams;

  // "Yours" (Tier 2) is listed separately: listReferences is the shared
  // catalog and never returns user-owned rows.
  if (params.get("scope") === "mine") {
    return NextResponse.json({ items: await listUserReferences(auth.session.userId) });
  }

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

  // Saving a URL fetches the page for structure extraction, so it's
  // throttled like brand import.
  const limit = await rateLimit({ key: `reference-save:${auth.session.userId}`, limit: 10, windowSec: 60 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many references saved. Try again in a minute." }, { status: 429 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid url is required" }, { status: 400 });
  }

  const reference = await saveUserReference(auth.session.userId, { url: parsed.data.url });
  return NextResponse.json({ reference });
}
