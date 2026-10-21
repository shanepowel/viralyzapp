import "dotenv/config";
import { NotConfigured, runMetaIngest } from "../src/lib/ads/meta-archive";

const COUNTRIES = (process.env.META_AD_LIBRARY_COUNTRIES || "GB,DE,FR")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const SEARCH_TERMS = (process.env.META_AD_LIBRARY_SEARCH_TERMS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  if (SEARCH_TERMS.length === 0) {
    console.error(
      "[ingest-meta] META_AD_LIBRARY_SEARCH_TERMS is required (comma-separated search terms)",
    );
    process.exit(1);
  }

  const { created, updated } = await runMetaIngest({ countries: COUNTRIES, searchTerms: SEARCH_TERMS });
  console.log(`[ingest-meta] done — ${created} created, ${updated} updated`);
}

main().catch((err) => {
  if (err instanceof NotConfigured) {
    console.error(`[ingest-meta] ${err.message}`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});
