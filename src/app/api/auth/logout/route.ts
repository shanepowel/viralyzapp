import { handleLogout } from "@/lib/auth-handlers";

export const dynamic = "force-dynamic";

/** @deprecated Prefer POST /api/logout */
export async function POST() {
  return handleLogout();
}
