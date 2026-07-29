import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { storeUpload, storageBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const content = await prisma.content.findFirst({
      where: { id, userId: auth.session.userId },
    });
    if (!content) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = await storeUpload({
      userId: auth.session.userId,
      contentId: id,
      originalFilename: file.name,
      bytes,
      contentType: file.type || "application/octet-stream",
    });

    const updated = await prisma.content.update({
      where: { id },
      data: {
        mediaUrl: stored.mediaUrl,
        storageKey: stored.storageKey,
        originalFilename: file.name,
      },
    });

    return NextResponse.json({
      id: updated.id,
      mediaUrl: updated.mediaUrl,
      originalFilename: updated.originalFilename,
      storage: storageBackend(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
