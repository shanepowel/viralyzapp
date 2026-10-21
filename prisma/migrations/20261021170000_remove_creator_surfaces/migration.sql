-- Safety guard: every user must already have at least one CreditLedger row
-- before creditsRemaining is dropped. The ledger has been authoritative
-- since it was introduced (reserve/settle/refund/adjust write only to it,
-- never back to creditsRemaining), so a user's ledger balance is expected
-- to diverge from their frozen creditsRemaining snapshot the moment they
-- spend or are granted credits through the ledger — that's not a problem,
-- it's the ledger doing its job. What *would* be a problem is a user who
-- never got backfilled into the ledger at all (their balance would
-- silently become 0 once the column is gone) — that's what this checks.
DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM "User" u
  WHERE NOT EXISTS (SELECT 1 FROM "CreditLedger" l WHERE l."userId" = u.id);

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Found % user(s) with no CreditLedger rows; refusing to drop creditsRemaining until every user has a ledger history', missing_count;
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
