import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { hasS3 } from "@/lib/env";

export type StoredObject = {
  storageKey: string;
  mediaUrl: string;
  backend: "local" | "s3";
};

function s3Client() {
  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
  return new S3Client({
    region: process.env.S3_REGION?.trim() || "auto",
    endpoint,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!.trim(),
      secretAccessKey: process.env.S3_SECRET_KEY!.trim(),
    },
  });
}

function publicS3Url(key: string) {
  const explicit = process.env.S3_PUBLIC_URL?.trim();
  if (explicit) return `${explicit.replace(/\/$/, "")}/${key}`;
  const endpoint = process.env.S3_ENDPOINT?.trim();
  const bucket = process.env.S3_BUCKET!.trim();
  if (endpoint) {
    return `${endpoint.replace(/\/$/, "")}/${bucket}/${key}`;
  }
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

async function putLocal(storageKey: string, bytes: Buffer): Promise<StoredObject> {
  const filename = path.basename(storageKey);
  const userDir = storageKey.split("/")[0];
  const dir = path.join(process.cwd(), "public", "uploads", userDir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return {
    storageKey,
    mediaUrl: `/uploads/${userDir}/${filename}`,
    backend: "local",
  };
}

async function putS3(
  storageKey: string,
  bytes: Buffer,
  contentType: string,
): Promise<StoredObject> {
  const bucket = process.env.S3_BUCKET!.trim();
  await s3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: storageKey,
      Body: bytes,
      ContentType: contentType,
    }),
  );
  return {
    storageKey,
    mediaUrl: publicS3Url(storageKey),
    backend: "s3",
  };
}

/** Upload media — S3 when configured, otherwise local `public/uploads/`. */
export async function storeUpload(opts: {
  userId: string;
  contentId: string;
  originalFilename: string;
  bytes: Buffer;
  contentType?: string;
}): Promise<StoredObject> {
  const safeName = opts.originalFilename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const storageKey = `${opts.userId}/${opts.contentId}-${Date.now()}-${safeName}`;
  const contentType = opts.contentType || "application/octet-stream";

  if (hasS3()) {
    return putS3(storageKey, opts.bytes, contentType);
  }
  return putLocal(storageKey, opts.bytes);
}

export function storageBackend() {
  return hasS3() ? "s3" : "local";
}

function localUploadPath(storageKey: string): string | null {
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const file = path.resolve(uploadsRoot, storageKey);
  if (file !== uploadsRoot && !file.startsWith(`${uploadsRoot}${path.sep}`)) return null;
  return file;
}

/** Reads a previously stored composite. Local disk, or S3 when that backend is configured. */
export async function readStoredObject(storageKey: string): Promise<Buffer | null> {
  if (hasS3()) {
    const bucket = process.env.S3_BUCKET!.trim();
    const res = await s3Client().send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }));
    if (!res.Body) return null;
    return Buffer.from(await res.Body.transformToByteArray());
  }
  const file = localUploadPath(storageKey);
  if (!file) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}
