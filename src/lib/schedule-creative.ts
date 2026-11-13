import { after } from "next/server";
import { processCreativeJob } from "@/lib/generation";

/** Keeps a variant running after the response. The next read resumes it if this isolate dies. */
export function scheduleCreative(creativeId: string): Promise<void> {
  after(() => processCreativeJob(creativeId));
  return Promise.resolve();
}
