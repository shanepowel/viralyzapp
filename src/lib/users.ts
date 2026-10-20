import { cookies } from "next/headers";
import type { User } from "@/generated/prisma/client";
import { isAdminEmail, isClerkEnabled, isInviteOnly } from "@/lib/env";
import { consumeInvite } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { parseSession } from "@/lib/session-cookie";

const AUTH_COOKIE = "viralyz_session";

export type AppUser = {
  id: string;
  email: string;
  name: string;
  handle: string | null;
  plan: string;
  creditsRemaining: number;
  role: string;
  onboardingDone: boolean;
  clerkUserId: string | null;
  avatarUrl: string | null;
};

export function toAppUser(user: User): AppUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    handle: user.handle,
    plan: user.plan,
    creditsRemaining: user.creditsRemaining,
    role: user.role,
    onboardingDone: user.onboardingDone,
    clerkUserId: user.clerkUserId,
    avatarUrl: user.avatarUrl,
  };
}

async function sessionFromCookie(): Promise<{ userId: string } | null> {
  const jar = await cookies();
  const payload = await parseSession(jar.get(AUTH_COOKIE)?.value);
  return payload ? { userId: payload.userId } : null;
}

/** Link or create app user from Clerk. Returns null when invite-only and no invite. */
export async function upsertUserFromClerk(input: {
  clerkUserId: string;
  email: string;
  name: string;
  inviteCode?: string;
}): Promise<AppUser | null> {
  const email = input.email.toLowerCase();

  const existingByClerk = await prisma.user.findUnique({ where: { clerkUserId: input.clerkUserId } });
  if (existingByClerk) return toAppUser(existingByClerk);

  const existingByEmail = await prisma.user.findUnique({ where: { email } });
  if (existingByEmail) {
    const linked = await prisma.user.update({
      where: { id: existingByEmail.id },
      data: {
        clerkUserId: input.clerkUserId,
        name: existingByEmail.name || input.name,
        role: isAdminEmail(email) ? "admin" : existingByEmail.role,
        emailVerifiedAt: existingByEmail.emailVerifiedAt ?? new Date(),
      },
    });
    return toAppUser(linked);
  }

  if (isInviteOnly()) {
    if (!input.inviteCode) return null;
    const consumed = await consumeInvite(input.inviteCode, email);
    if (!consumed.ok) return null;
  }

  const handleBase =
    email.split("@")[0]?.replace(/[^a-z0-9_]/gi, "").slice(0, 24) ||
    `creator${Date.now().toString().slice(-4)}`;
  const handleTaken = await prisma.user.findUnique({ where: { handle: handleBase } });
  const handle = handleTaken ? `${handleBase}${Math.floor(Math.random() * 900 + 100)}` : handleBase;

  const created = await prisma.user.create({
    data: {
      email,
      name: input.name || handle,
      handle,
      passwordHash: null,
      clerkUserId: input.clerkUserId,
      plan: isAdminEmail(email) ? "unlimited" : "credits",
      creditsRemaining: isAdminEmail(email) ? 999 : 10,
      role: isAdminEmail(email) ? "admin" : "user",
      emailVerifiedAt: new Date(),
      inviteCodeUsed: input.inviteCode?.trim().toUpperCase() ?? null,
      onboardingDone: false,
      mediaKit: {
        create: { viewsThisWeek: 0, newOrdersCount: 0, followers: 0, engagementPct: 0 },
      },
    },
  });

  return toAppUser(created);
}

export type ClerkIdentity = {
  clerkUserId: string;
  email: string;
  name: string;
};

/** Distinguishes "not signed in via Clerk" from "Clerk lookup failed". */
const CLERK_ERROR = Symbol("clerk-error");
type ClerkLookup = ClerkIdentity | null | typeof CLERK_ERROR;

async function lookupClerkIdentity(): Promise<ClerkLookup> {
  if (!isClerkEnabled()) return null;
  try {
    const { auth, currentUser } = await import("@clerk/nextjs/server");
    const { userId } = await auth();
    if (!userId) return null;
    const cu = await currentUser();
    if (!cu) return null;
    const email = cu.primaryEmailAddress?.emailAddress ?? cu.emailAddresses?.[0]?.emailAddress;
    if (!email) return null;
    const name =
      cu.fullName?.trim() ||
      [cu.firstName, cu.lastName].filter(Boolean).join(" ").trim() ||
      email.split("@")[0] ||
      "Creator";
    return { clerkUserId: userId, email, name };
  } catch {
    // Swallowing this used to fall through to the cookie session, silently switching
    // the request to a different user. Fail closed instead.
    return CLERK_ERROR;
  }
}

export async function getClerkIdentity(): Promise<ClerkIdentity | null> {
  const result = await lookupClerkIdentity();
  return result === CLERK_ERROR ? null : result;
}

/**
 * Resolve the signed-in app user.
 *
 * Deterministic precedence: a live Clerk identity always wins; the legacy cookie is
 * only consulted when Clerk is disabled or reports no session. If the Clerk lookup
 * errors we return null (fail closed) rather than falling back to the cookie, which
 * could otherwise resolve the request to a different user mid-session.
 */
export async function resolveAppUser(): Promise<AppUser | null> {
  const lookup = await lookupClerkIdentity();
  if (lookup === CLERK_ERROR) return null;

  const clerk = lookup;
  if (clerk) {
    const byClerk = await prisma.user.findUnique({ where: { clerkUserId: clerk.clerkUserId } });
    if (byClerk) return toAppUser(byClerk);

    const byEmail = await prisma.user.findUnique({ where: { email: clerk.email.toLowerCase() } });
    if (byEmail) {
      return upsertUserFromClerk({
        clerkUserId: clerk.clerkUserId,
        email: clerk.email,
        name: clerk.name,
      });
    }

    // Invite-only: new SSO users must claim an invite first
    if (isInviteOnly()) return null;

    return upsertUserFromClerk({
      clerkUserId: clerk.clerkUserId,
      email: clerk.email,
      name: clerk.name,
    });
  }

  const cookie = await sessionFromCookie();
  if (!cookie) return null;
  const user = await prisma.user.findUnique({ where: { id: cookie.userId } });
  return user ? toAppUser(user) : null;
}
