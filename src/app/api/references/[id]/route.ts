import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { deleteUserReference, getReferenceForUser } from "@/lib/references";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const reference = await getReferenceForUser(id, auth.session.userId);
  if (!reference) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ reference });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const { id } = await params;
  const deleted = await deleteUserReference(id, auth.session.userId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
