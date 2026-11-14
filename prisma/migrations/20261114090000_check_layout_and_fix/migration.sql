-- Where each piece of text sits on the ad, so a problem can be marked on the
-- ad itself, and what a wording rewrite replaced, so it can be undone.
ALTER TABLE "Check" ADD COLUMN "layout" JSONB;
ALTER TABLE "Check" ADD COLUMN "fix" JSONB;
