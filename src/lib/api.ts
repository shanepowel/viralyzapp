import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";

export async function requireApiSession(): Promise<
  { session: SessionUser; error?: undefined } | { session?: undefined; error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}
