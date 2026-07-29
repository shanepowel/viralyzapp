import "dotenv/config";
import { createScoreWorker } from "../src/lib/queue";
import { processScoreJob } from "../src/lib/jobs";

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

  const shutdown = async () => {
    console.log("[viralyz-worker] shutting down…");
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
