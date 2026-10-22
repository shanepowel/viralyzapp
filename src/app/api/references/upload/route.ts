import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { saveUserReference } from "@/lib/references";
import { storeUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5_000_000;
const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export async function POST(req: Request) {
  const auth = await requireApiSession();
  if (auth.error) return auth.error;

  const limit = await rateLimit({ key: `reference-upload:${auth.session.userId}`, limit: 10, windowSec: 60 });
  if (!limit.ok) {
    return NextResponse.json({ error: "Too many uploads. Try again in a minute." }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach an image file" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Upload a PNG, JPEG, WebP or GIF image" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Images must be 5 MB or smaller" }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const stored = await storeUpload({
    userId: auth.session.userId,
    contentId: "reference",
    originalFilename: file.name || "reference",
    bytes,
    contentType: file.type,
  });

  const reference = await saveUserReference(auth.session.userId, {
    file: stored,
    image: { data: bytes, mediaType: file.type },
  });
  return NextResponse.json({ reference });
}
