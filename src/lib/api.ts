import { NextResponse } from "next/server";
import type { AppUser } from "@/lib/users";
import { resolveAppUser } from "@/lib/users";

export async function requireApiSession(): Promise<
  { session: { userId: string; email: string; name: string }; user: AppUser; error?: undefined }
  | { session?: undefined; user?: undefined; error: NextResponse }
> {
  const user = await resolveAppUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return {
    session: { userId: user.id, email: user.email, name: user.name },
    user,
  };
}

export async function requireAdmin(): Promise<
  { user: AppUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const user = await resolveAppUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}
