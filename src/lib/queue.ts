import { Queue, Worker, type Job } from "bullmq";
import { hasRedis } from "@/lib/env";

export const SCORE_QUEUE_NAME = "viralyz-score";

let queue: Queue | null = null;

function connectionFromUrl() {
  const url = process.env.REDIS_URL!.trim();
  return { url };
}

export function getScoreQueue(): Queue | null {
  if (!hasRedis()) return null;
  if (!queue) {
    queue = new Queue(SCORE_QUEUE_NAME, { connection: connectionFromUrl() });
  }
  return queue;
}

export async function enqueueOnBull(jobId: string) {
  const q = getScoreQueue();
  if (!q) return false;
  await q.add(
    "score",
    { jobId },
    {
      jobId,
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  );
  return true;
}

export function createScoreWorker(processor: (jobId: string) => Promise<void>) {
  if (!hasRedis()) {
    throw new Error("REDIS_URL is required to start the score worker");
  }
  return new Worker(
    SCORE_QUEUE_NAME,
    async (job: Job<{ jobId: string }>) => {
      await processor(job.data.jobId);
    },
    { connection: connectionFromUrl(), concurrency: 2 },
  );
}

export function queueBackend() {
  return hasRedis() ? "bullmq" : "inline";
}
