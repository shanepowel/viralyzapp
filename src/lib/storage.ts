import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { put } from "@vercel/blob";
import { hasBlob, hasS3 } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export type StoredObject = {
  storageKey: string;
  mediaUrl: string;
  backend: "local" | "s3" | "blob" | "database";
};

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

/** Public Vercel Blob URLs only. Anything else is not fetched, so a stored key cannot become an SSRF target. */
export function isVercelBlobUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.endsWith(BLOB_HOST_SUFFIX);
  } catch {
    return false;
  }
}

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

async function putBlob(
  storageKey: string,
  bytes: Buffer,
  contentType: string,
): Promise<StoredObject> {
  const blob = await put(storageKey, bytes, {
    access: "public",
    contentType,
    addRandomSuffix: false,
  });
  return {
    storageKey: blob.url,
    mediaUrl: blob.url,
    backend: "blob",
  };
}

function persistInDatabase() {
  return process.env.NODE_ENV === "production" && Boolean(process.env.DATABASE_URL?.trim());
}

async function putDatabase(
  bytes: Buffer,
  contentType: string,
  userId: string,
): Promise<StoredObject> {
  const row = await prisma.storedFile.create({
    data: { userId, contentType, bytes: new Uint8Array(bytes) },
  });
  return {
    storageKey: `db:${row.id}`,
    mediaUrl: `/api/media/${row.id}`,
    backend: "database",
  };
}

/** Upload media — S3, then Vercel Blob, then Postgres in production, otherwise local disk. */
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
  if (hasBlob()) {
    return putBlob(storageKey, opts.bytes, contentType);
  }
  if (persistInDatabase()) {
    return putDatabase(opts.bytes, contentType, opts.userId);
  }
  return putLocal(storageKey, opts.bytes);
}

export function storageBackend() {
  if (hasS3()) return "s3";
  if (hasBlob()) return "blob";
  if (persistInDatabase()) return "database";
  return "local";
}

function localUploadPath(storageKey: string): string | null {
  const uploadsRoot = path.resolve(process.cwd(), "public", "uploads");
  const file = path.resolve(uploadsRoot, storageKey);
  if (file !== uploadsRoot && !file.startsWith(`${uploadsRoot}${path.sep}`)) return null;
  return file;
}

/** Reads a previously stored composite. Blob URL, S3, or local disk. */
export async function readStoredObject(storageKey: string): Promise<Buffer | null> {
  if (storageKey.startsWith("db:")) {
    const row = await prisma.storedFile.findUnique({ where: { id: storageKey.slice(3) } });
    return row ? Buffer.from(row.bytes) : null;
  }
  if (isVercelBlobUrl(storageKey)) {
    const res = await fetch(storageKey);
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  }
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
