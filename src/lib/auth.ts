import { cookies } from "next/headers";

export const AUTH_COOKIE = "viralyz_session";

export type SessionUser = {
  email: string;
  name: string;
};

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(AUTH_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as SessionUser;
    if (!parsed.email || !parsed.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function sessionCookieValue(user: SessionUser): string {
  return encodeURIComponent(JSON.stringify(user));
}
