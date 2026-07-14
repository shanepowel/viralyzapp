import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { getContentLatest } from "@/lib/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;
  try {
    const { id } = await params;
    const data = await getContentLatest(id, auth.session.userId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load content";
    const status = message.includes("not found") || message.includes("No") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
