-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'credits',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Platform" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "syncStatus" TEXT NOT NULL DEFAULT 'ok',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Platform_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Content" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "platformId" TEXT,
    "title" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'video',
    "durationSec" INTEGER NOT NULL,
    "thumbnailUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduledFor" DATETIME,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Content_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Content_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContentVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentVersion_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Score" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentVersionId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "componentScores" JSONB NOT NULL,
    "componentNotes" JSONB NOT NULL,
    "verdict" TEXT NOT NULL,
    "predictedViewsLow" INTEGER NOT NULL,
    "predictedViewsHigh" INTEGER NOT NULL,
    "confidencePct" INTEGER NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Score_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActualPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentId" TEXT NOT NULL,
    "actualViews" INTEGER NOT NULL,
    "measuredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ActualPerformance_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Fix" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentVersionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "suggestionText" TEXT NOT NULL,
    "pointValue" INTEGER NOT NULL,
    "railSeverity" TEXT NOT NULL DEFAULT 'med',
    "applied" BOOLEAN NOT NULL DEFAULT false,
    "appliedAt" DATETIME,
    "pointsEarned" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Fix_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RetentionCurve" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentVersionId" TEXT NOT NULL,
    "curvePoints" JSONB NOT NULL,
    "riskMomentSec" INTEGER,
    "riskNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RetentionCurve_contentVersionId_fkey" FOREIGN KEY ("contentVersionId") REFERENCES "ContentVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Insight" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "supportingNote" TEXT NOT NULL,
    "metricKey" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '?',
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Insight_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MediaKit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "viewsThisWeek" INTEGER NOT NULL DEFAULT 0,
    "newOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MediaKit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ScoreJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "result" JSONB,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ScoreJob_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "Content" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "User_createdAt_idx" ON "User"("createdAt");

-- CreateIndex
CREATE INDEX "Platform_userId_idx" ON "Platform"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Platform_userId_provider_handle_key" ON "Platform"("userId", "provider", "handle");

-- CreateIndex
CREATE INDEX "Content_userId_idx" ON "Content"("userId");

-- CreateIndex
CREATE INDEX "Content_status_idx" ON "Content"("status");

-- CreateIndex
CREATE INDEX "Content_platformId_idx" ON "Content"("platformId");

-- CreateIndex
CREATE INDEX "ContentVersion_contentId_idx" ON "ContentVersion"("contentId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentVersion_contentId_versionNumber_key" ON "ContentVersion"("contentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Score_contentVersionId_key" ON "Score"("contentVersionId");

-- CreateIndex
CREATE INDEX "Score_computedAt_idx" ON "Score"("computedAt");

-- CreateIndex
CREATE INDEX "ActualPerformance_contentId_idx" ON "ActualPerformance"("contentId");

-- CreateIndex
CREATE INDEX "ActualPerformance_measuredAt_idx" ON "ActualPerformance"("measuredAt");

-- CreateIndex
CREATE INDEX "Fix_contentVersionId_idx" ON "Fix"("contentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "RetentionCurve_contentVersionId_key" ON "RetentionCurve"("contentVersionId");

-- CreateIndex
CREATE INDEX "Insight_userId_idx" ON "Insight"("userId");

-- CreateIndex
CREATE INDEX "Insight_computedAt_idx" ON "Insight"("computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaKit_userId_key" ON "MediaKit"("userId");

-- CreateIndex
CREATE INDEX "ScoreJob_contentId_idx" ON "ScoreJob"("contentId");

-- CreateIndex
CREATE INDEX "ScoreJob_status_idx" ON "ScoreJob"("status");
