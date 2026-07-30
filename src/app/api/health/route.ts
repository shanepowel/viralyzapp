import { NextResponse } from "next/server";
import {
  hasRedis,
  hasResend,
  hasS3,
  hasScoringService,
  isClerkEnabled,
  isInviteOnly,
} from "@/lib/env";
import { isOAuthConfigured } from "@/lib/oauth";
import { queueBackend } from "@/lib/queue";
import { scoringBackend } from "@/lib/scoring-service";
import { storageBackend } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Public adapter status — which production backends are active. */
export async function GET() {
  return NextResponse.json({
    storage: storageBackend(),
    queue: queueBackend(),
    scoring: scoringBackend(),
    redis: hasRedis(),
    s3: hasS3(),
    scoringService: hasScoringService(),
    clerk: isClerkEnabled(),
    resend: hasResend(),
    inviteOnly: isInviteOnly(),
    oauth: {
      tiktok: isOAuthConfigured("tiktok"),
      instagram: isOAuthConfigured("instagram"),
      youtube: isOAuthConfigured("youtube"),
    },
  });
}
