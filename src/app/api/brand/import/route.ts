import { NextResponse } from "next/server";
import { z } from "zod";
import { requireApiSession } from "@/lib/api";
import { extractBrand } from "@/lib/brand-import";
import { rateLimit } from "@/lib/rate-limit";
import { SafeFetchError, safeFetch } from "@/lib/safe-fetch";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ url: z.string().url() });

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const limit = await rateLimit({ key: `brand-import:${auth.session.userId}`, limit: 10, windowSec: 60 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many import attempts. Try again in a minute." },
      { status: 429 },
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "A valid url is required" }, { status: 400 });
  }

  try {
    const page = await safeFetch(parsed.data.url);
    const draft = extractBrand(page.body, parsed.data.url);
    return NextResponse.json({ draft });
  } catch (err) {
    if (err instanceof SafeFetchError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message, code: "fetch_failed" }, { status: 400 });
  }
}
