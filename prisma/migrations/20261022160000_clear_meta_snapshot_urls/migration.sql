-- Meta's ad_snapshot_url embeds the Ad Library access_token as a query
-- parameter. Earlier ingests stored it as thumbnailUrl, which Discover then
-- rendered for every user. Ingest no longer stores it; clear what's there.
UPDATE "Reference" SET "thumbnailUrl" = NULL WHERE "source" = 'meta_eu_uk';
