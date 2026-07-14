import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

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
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const storageKey = `${auth.session.userId}/${id}-${Date.now()}-${safeName}`;
    const dir = path.join(process.cwd(), "public", "uploads", auth.session.userId);
    await mkdir(dir, { recursive: true });
    const filename = path.basename(storageKey);
    await writeFile(path.join(dir, filename), bytes);

    const mediaUrl = `/uploads/${auth.session.userId}/${filename}`;
    const updated = await prisma.content.update({
      where: { id },
      data: {
        mediaUrl,
        storageKey,
        originalFilename: file.name,
      },
    });

    return NextResponse.json({
      id: updated.id,
      mediaUrl: updated.mediaUrl,
      originalFilename: updated.originalFilename,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
