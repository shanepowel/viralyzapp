import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { continueOpenCreatives } from "@/lib/generation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(header: string | null, secret: string) {
  const got = Buffer.from(header ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}

/** Resumes variants whose request died. Vercel sends Authorization: Bearer $CRON_SECRET. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret || !authorized(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const handled = await continueOpenCreatives();
  return NextResponse.json({ handled });
}
