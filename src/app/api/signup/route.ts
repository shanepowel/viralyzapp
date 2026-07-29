import { handleSignup } from "@/lib/auth-handlers";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleSignup(req);
}
