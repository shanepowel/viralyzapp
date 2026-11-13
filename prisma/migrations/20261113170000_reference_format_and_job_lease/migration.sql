-- AlterTable
ALTER TABLE "Reference" ADD COLUMN "format" TEXT;

-- Saved uploads are images. A pasted URL only counts when the link itself is a media file.
UPDATE "Reference" SET "format" = 'image' WHERE "source" = 'user_upload' AND "format" IS NULL;
UPDATE "Reference" SET "format" = 'video'
WHERE "format" IS NULL AND "sourceRef" ~* '\.(mp4|webm|mov|m4v)(\?|$)';
UPDATE "Reference" SET "format" = 'image'
WHERE "format" IS NULL AND "source" = 'user_url' AND "sourceRef" ~* '\.(png|jpe?g|webp|gif)(\?|$)';

-- AlterTable
ALTER TABLE "Creative" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Creative" ADD COLUMN "runId" TEXT;

-- CreateIndex
CREATE INDEX "Reference_userId_format_idx" ON "Reference"("userId", "format");
