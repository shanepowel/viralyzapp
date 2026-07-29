-- AlterTable
ALTER TABLE "Platform" ADD COLUMN "externalAccountId" TEXT;
ALTER TABLE "Platform" ADD COLUMN "accessToken" TEXT;
ALTER TABLE "Platform" ADD COLUMN "refreshToken" TEXT;
ALTER TABLE "Platform" ADD COLUMN "tokenExpiresAt" DATETIME;
ALTER TABLE "Platform" ADD COLUMN "scopes" TEXT;

-- CreateIndex
CREATE INDEX "Platform_provider_idx" ON "Platform"("provider");
