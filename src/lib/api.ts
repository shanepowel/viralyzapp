import { NextResponse } from "next/server";
import { isStaffRole } from "@/lib/roles";
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
  if (!isStaffRole(user.role)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user };
}

export async function requireSuperAdmin(): Promise<
  { user: AppUser; error?: undefined } | { user?: undefined; error: NextResponse }
> {
  const auth = await requireAdmin();
  if (auth.error) return auth;
  if (auth.user.role !== "superadmin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user: auth.user };
}
