import { NextResponse } from "next/server";
import { getContentLatest } from "@/lib/content";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await getContentLatest(id);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load content";
    const status = message.includes("No") || message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
