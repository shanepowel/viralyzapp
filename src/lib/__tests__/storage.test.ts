import { put } from "@vercel/blob";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isVercelBlobUrl, readStoredObject, storageBackend, storeUpload } from "@/lib/storage";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(),
}));

describe("blob storage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("accepts only https vercel blob hosts", () => {
    expect(isVercelBlobUrl("https://store.public.blob.vercel-storage.com/user/file.png")).toBe(true);
    expect(isVercelBlobUrl("https://evil.example/file.png")).toBe(false);
    expect(isVercelBlobUrl("http://store.public.blob.vercel-storage.com/file.png")).toBe(false);
    expect(isVercelBlobUrl("/uploads/file.png")).toBe(false);
  });

  it("does not fetch a stored key that is not a blob url", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(readStoredObject("https://169.254.169.254/latest")).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reads bytes from a public blob url", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(Uint8Array.from([1, 2, 3]))),
    );
    const bytes = await readStoredObject("https://store.public.blob.vercel-storage.com/user/file.png");
    expect(bytes).toEqual(Buffer.from([1, 2, 3]));
  });

  it("uses the database in production when blob and s3 are unset", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://example");
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "");
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("S3_ACCESS_KEY", "");
    vi.stubEnv("S3_SECRET_KEY", "");
    expect(storageBackend()).toBe("database");
  });

  it("stores through blob when the token is set and s3 is not", async () => {
    vi.stubEnv("BLOB_READ_WRITE_TOKEN", "vercel_blob_rw_test");
    vi.stubEnv("S3_BUCKET", "");
    vi.stubEnv("S3_ACCESS_KEY", "");
    vi.stubEnv("S3_SECRET_KEY", "");
    vi.mocked(put).mockResolvedValue({
      url: "https://store.public.blob.vercel-storage.com/user/file.png",
      downloadUrl: "https://store.public.blob.vercel-storage.com/user/file.png?download=1",
      pathname: "user/file.png",
      contentType: "image/png",
      contentDisposition: "inline",
      etag: "etag",
    });

    const stored = await storeUpload({
      userId: "user",
      contentId: "creative",
      originalFilename: "ad.png",
      bytes: Buffer.from("png"),
      contentType: "image/png",
    });

    expect(stored.backend).toBe("blob");
    expect(stored.mediaUrl).toBe("https://store.public.blob.vercel-storage.com/user/file.png");
    expect(stored.storageKey).toBe(stored.mediaUrl);
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^user\/creative-\d+-ad\.png$/),
      Buffer.from("png"),
      expect.objectContaining({ access: "public", contentType: "image/png" }),
    );
  });
});
