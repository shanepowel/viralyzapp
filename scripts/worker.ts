import "dotenv/config";
import {
  createMetaIngestWorker,
  createScoreWorker,
  createStudioWorker,
  scheduleMetaIngest,
} from "../src/lib/queue";
import { processScoreJob } from "../src/lib/jobs";
import { processCreativeJob } from "../src/lib/generation";
import { runMetaIngest } from "../src/lib/ads/meta-archive";
import { metaAdLibraryToken } from "../src/lib/env";

const META_INGEST_COUNTRIES = (process.env.META_AD_LIBRARY_COUNTRIES || "GB,DE,FR")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const META_INGEST_SEARCH_TERMS = (process.env.META_AD_LIBRARY_SEARCH_TERMS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function main() {
  if (!process.env.REDIS_URL?.trim()) {
    console.error("REDIS_URL is required. Example: redis://localhost:6379");
    process.exit(1);
  }

  console.log("[viralyz-worker] starting BullMQ score worker…");
  const worker = createScoreWorker(async (jobId) => {
    console.log(`[viralyz-worker] processing ${jobId}`);
    await processScoreJob(jobId);
    console.log(`[viralyz-worker] completed ${jobId}`);
  });
  worker.on("failed", (job, err) => {
    console.error(`[viralyz-worker] failed ${job?.id}:`, err.message);
  });

  // Only schedule the daily ingest once there's a token and something to
  // search for — otherwise every run would just fail with NotConfigured.
  let metaWorker: ReturnType<typeof createMetaIngestWorker> | null = null;
  if (metaAdLibraryToken() && META_INGEST_SEARCH_TERMS.length > 0) {
    console.log("[viralyz-worker] scheduling daily Meta ad library ingest…");
    await scheduleMetaIngest();
    metaWorker = createMetaIngestWorker(async () => {
      const { created, updated } = await runMetaIngest({
        countries: META_INGEST_COUNTRIES,
        searchTerms: META_INGEST_SEARCH_TERMS,
      });
      console.log(`[viralyz-worker] meta ingest — ${created} created, ${updated} updated`);
    });
    metaWorker.on("failed", (job, err) => {
      console.error(`[viralyz-worker] meta ingest failed ${job?.id}:`, err.message);
    });
  } else {
    console.log(
      "[viralyz-worker] META_AD_LIBRARY_TOKEN or META_AD_LIBRARY_SEARCH_TERMS not set — skipping ingest schedule",
    );
  }

  console.log("[viralyz-worker] starting BullMQ studio worker…");
  const studioWorker = createStudioWorker(async (creativeId) => {
    console.log(`[viralyz-worker] generating ${creativeId}`);
    await processCreativeJob(creativeId);
    console.log(`[viralyz-worker] generated ${creativeId}`);
  });
  studioWorker.on("failed", (job, err) => {
    console.error(`[viralyz-worker] studio job failed ${job?.id}:`, err.message);
  });

  const shutdown = async () => {
    console.log("[viralyz-worker] shutting down…");
    await worker.close();
    await metaWorker?.close();
    await studioWorker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
