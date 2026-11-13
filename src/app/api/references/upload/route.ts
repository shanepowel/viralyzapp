import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import { saveUserReference } from "@/lib/references";
import { storeUpload } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_IMAGE_BYTES = 5_000_000;
const MAX_VIDEO_BYTES = 12_000_000;
const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

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
    return NextResponse.json({ error: "Attach an image or video file" }, { status: 400 });
  }
  const isImage = IMAGE_TYPES.has(file.type);
  const isVideo = VIDEO_TYPES.has(file.type);
  if (!isImage && !isVideo) {
    return NextResponse.json({ error: "Upload a PNG, JPEG, WebP, GIF, MP4, WebM or QuickTime file" }, { status: 400 });
  }
  const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: isVideo ? "Videos must be 12 MB or smaller" : "Images must be 5 MB or smaller" },
      { status: 400 },
    );
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
    contentType: file.type,
    image: isImage ? { data: bytes, mediaType: file.type } : undefined,
  });
  return NextResponse.json({ reference });
}
