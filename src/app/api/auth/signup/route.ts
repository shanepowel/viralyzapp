import { handleSignup } from "@/lib/auth-handlers";

export const dynamic = "force-dynamic";

/** @deprecated Prefer POST /api/signup */
export async function POST(req: Request) {
  return handleSignup(req);
}
