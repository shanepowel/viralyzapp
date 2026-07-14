import { NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  provider: z.enum(["tiktok", "instagram", "youtube"]),
});

/** OAuth kickoff stub — returns a mock authorize URL for local/demo. */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return NextResponse.json({
      authorizeUrl: `${base}/api/platforms/connect?provider=${parsed.data.provider}&demo=1`,
      message: "Demo mode: OAuth is stubbed. Wire real provider credentials in production.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start connect";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const provider = new URL(req.url).searchParams.get("provider") ?? "tiktok";
  return NextResponse.json({
    ok: true,
    provider,
    message: `Demo OAuth callback for ${provider}. No account was linked.`,
  });
}
