-- Safety guard: every user's CreditLedger balance must match their current
-- creditsRemaining before that column (and the creator-surface tables below)
-- are dropped. This is the last point at which the two can be compared —
-- abort rather than silently losing the discrepancy.
DO $$
DECLARE
  mismatch_count integer;
BEGIN
  SELECT count(*) INTO mismatch_count
  FROM "User" u
  LEFT JOIN (
    SELECT "userId", COALESCE(SUM("delta"), 0) AS balance
    FROM "CreditLedger"
    GROUP BY "userId"
  ) l ON l."userId" = u.id
  WHERE COALESCE(l.balance, 0) <> u."creditsRemaining";

  IF mismatch_count > 0 THEN
    RAISE EXCEPTION 'CreditLedger balance does not match User.creditsRemaining for % user(s); aborting migration', mismatch_count;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "ActualPerformance" DROP CONSTRAINT "ActualPerformance_contentId_fkey";

-- DropForeignKey
ALTER TABLE "Content" DROP CONSTRAINT "Content_platformId_fkey";

-- DropForeignKey
ALTER TABLE "Content" DROP CONSTRAINT "Content_userId_fkey";

-- DropForeignKey
ALTER TABLE "ContentVersion" DROP CONSTRAINT "ContentVersion_contentId_fkey";

-- DropForeignKey
ALTER TABLE "EngageComment" DROP CONSTRAINT "EngageComment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Fix" DROP CONSTRAINT "Fix_contentVersionId_fkey";

-- DropForeignKey
ALTER TABLE "Insight" DROP CONSTRAINT "Insight_userId_fkey";

-- DropForeignKey
ALTER TABLE "MediaKit" DROP CONSTRAINT "MediaKit_userId_fkey";

-- DropForeignKey
ALTER TABLE "RetentionCurve" DROP CONSTRAINT "RetentionCurve_contentVersionId_fkey";

-- DropForeignKey
ALTER TABLE "Score" DROP CONSTRAINT "Score_contentVersionId_fkey";

-- DropForeignKey
ALTER TABLE "ScoreJob" DROP CONSTRAINT "ScoreJob_contentId_fkey";

-- DropForeignKey
ALTER TABLE "ToolRun" DROP CONSTRAINT "ToolRun_userId_fkey";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "creditsRemaining";

-- DropTable
DROP TABLE "ActualPerformance";

-- DropTable
DROP TABLE "CompetitorPost";

-- DropTable
DROP TABLE "Content";

-- DropTable
DROP TABLE "ContentVersion";

-- DropTable
DROP TABLE "EngageComment";

-- DropTable
DROP TABLE "Fix";

-- DropTable
DROP TABLE "Insight";

-- DropTable
DROP TABLE "MediaKit";

-- DropTable
DROP TABLE "RetentionCurve";

-- DropTable
DROP TABLE "Score";

-- DropTable
DROP TABLE "ScoreJob";

-- DropTable
DROP TABLE "ToolRun";

-- DropTable
DROP TABLE "Trend";
