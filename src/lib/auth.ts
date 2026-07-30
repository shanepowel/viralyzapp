import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isClerkEnabled } from "@/lib/env";
import { getClerkIdentity, resolveAppUser } from "@/lib/users";

export const AUTH_COOKIE = "viralyz_session";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Cookie-only session (used by login handlers). Prefer resolveAppUser / getSession for pages. */
export async function getCookieSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(AUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SessionUser;
    if (!parsed.userId || !parsed.email || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** App session — Clerk identity or cookie. */
export async function getSession(): Promise<SessionUser | null> {
  const user = await resolveAppUser();
  if (!user) return null;
  return { userId: user.id, email: user.email, name: user.name };
}

export function sessionCookieValue(user: SessionUser): string {
  return encodeURIComponent(JSON.stringify(user));
}

export async function requireSession(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

/** For server pages — redirects to claim-invite (SSO) or login. */
export async function requirePageSession(): Promise<SessionUser> {
  const session = await getSession();
  if (session) return session;
  if (isClerkEnabled()) {
    const clerk = await getClerkIdentity();
    if (clerk) redirect("/claim-invite");
  }
  redirect("/login");
}

export async function getSessionUser() {
  return resolveAppUser();
}
