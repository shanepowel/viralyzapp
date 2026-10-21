import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { isClerkEnabled } from "@/lib/env";
import { serializeSession } from "@/lib/session-cookie";
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

/** App session — Clerk identity or cookie. */
export async function getSession(): Promise<SessionUser | null> {
  const user = await resolveAppUser();
  if (!user) return null;
  return { userId: user.id, email: user.email, name: user.name };
}

/** HMAC-signed cookie value. Never store unsigned session state. */
export async function sessionCookieValue(user: SessionUser): Promise<string> {
  return serializeSession(user);
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
