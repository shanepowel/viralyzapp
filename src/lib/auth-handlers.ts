import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, hashPassword, sessionCookieValue, verifyPassword } from "@/lib/auth";
import { demoLoginEmail, isDemoLoginEnabled, isInviteOnly } from "@/lib/env";
import { consumeInvite } from "@/lib/invites";
import { prisma } from "@/lib/prisma";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session-cookie";

const loginSchema = z
  .object({
    email: z.string().email().optional(),
    password: z.string().min(1).optional(),
    demo: z.boolean().optional(),
  })
  .refine((v) => v.demo === true || (Boolean(v.email) && Boolean(v.password)), {
    message: "Enter a valid email and password.",
  });

const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  inviteCode: z.string().min(4).max(32).optional(),
  handle: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/i)
    .optional(),
});

async function sessionResponse(user: {
  id: string;
  email: string;
  name: string;
  handle: string | null;
}) {
  const session = { userId: user.id, email: user.email, name: user.name };
  const res = NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name, handle: user.handle },
  });
  res.cookies.set(AUTH_COOKIE, await sessionCookieValue(session), SESSION_COOKIE_OPTIONS);
  return res;
}

/**
 * Resolve the demo account for one-click sign-in.
 *
 * Deliberately narrow:
 *  - only runs when DEMO_LOGIN is explicitly enabled;
 *  - never creates, promotes, or resets an account;
 *  - refuses to issue a session for a privileged account.
 *
 * The previous implementation reset this account's password to a constant and forced
 * role=admin on every login attempt, which made it a permanent public admin credential
 * and silently reverted any manual demotion. Do not reintroduce that behaviour — seed
 * the demo user via `prisma/seed.ts` instead.
 */
async function resolveDemoUser() {
  if (!isDemoLoginEnabled()) return null;
  const user = await prisma.user.findUnique({ where: { email: demoLoginEmail() } });
  if (!user) return null;
  if (user.role === "admin") return null;
  return user;
}

export async function handleLogin(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = await rateLimit({ key: `login:${ip}`, limit: 30, windowSec: 60 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many login attempts. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const json = await req.json();
    const parsed = loginSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    }

    if (parsed.data.demo) {
      const demoUser = await resolveDemoUser();
      if (!demoUser) {
        return NextResponse.json({ error: "Demo sign-in is unavailable." }, { status: 403 });
      }
      return sessionResponse(demoUser);
    }

    const email = (parsed.data.email ?? "").toLowerCase();
    const password = parsed.data.password ?? "";

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    return sessionResponse(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handleSignup(req: Request) {
  try {
    const ip = clientIp(req);
    const rl = await rateLimit({ key: `signup:${ip}`, limit: 10, windowSec: 60 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Too many signups from this network. Try again shortly." },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
      );
    }

    const json = await req.json();
    const parsed = signupSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a name, valid email, password (8+ chars), and invite code if required." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    let inviteCodeUsed: string | null = null;

    if (isInviteOnly()) {
      if (!parsed.data.inviteCode) {
        return NextResponse.json(
          { error: "An invite code is required. Join the waitlist if you don't have one." },
          { status: 403 },
        );
      }
      const consumed = await consumeInvite(parsed.data.inviteCode, email);
      if (!consumed.ok) {
        return NextResponse.json({ error: consumed.error }, { status: 403 });
      }
      inviteCodeUsed = consumed.invite.code;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    }

    const handle =
      parsed.data.handle?.toLowerCase() ??
      email.split("@")[0]?.replace(/[^a-z0-9_]/gi, "").slice(0, 24) ??
      `creator${Date.now().toString().slice(-4)}`;

    const handleTaken = await prisma.user.findUnique({ where: { handle } });
    const finalHandle = handleTaken ? `${handle}${Math.floor(Math.random() * 900 + 100)}` : handle;

    const user = await prisma.user.create({
      data: {
        email,
        name: parsed.data.name,
        handle: finalHandle,
        passwordHash: await hashPassword(parsed.data.password),
        plan: "credits",
        creditsRemaining: 10,
        inviteCodeUsed,
        emailVerifiedAt: null,
        mediaKit: {
          create: { viewsThisWeek: 0, newOrdersCount: 0, followers: 0, engagementPct: 0 },
        },
      },
    });

    return sessionResponse(user);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Signup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function handleLogout() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, "", { ...SESSION_COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
