import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, hashPassword, sessionCookieValue, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  handle: z
    .string()
    .min(2)
    .max(32)
    .regex(/^[a-z0-9_]+$/i)
    .optional(),
});

function sessionResponse(user: {
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
  res.cookies.set(AUTH_COOKIE, sessionCookieValue(session), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}

/** Create / repair seeded tester accounts if missing on this database. */
async function ensureDemoUsers() {
  const maya = await prisma.user.findUnique({ where: { email: "maya@viralyz.com" } });
  if (maya) {
    const ok = await verifyPassword("demo1234", maya.passwordHash);
    if (!ok) {
      await prisma.user.update({
        where: { id: maya.id },
        data: { passwordHash: await hashPassword("demo1234"), plan: "unlimited" },
      });
    }
  } else {
    await prisma.user.create({
      data: {
        email: "maya@viralyz.com",
        name: "Maya",
        handle: "mayacooks",
        passwordHash: await hashPassword("demo1234"),
        plan: "unlimited",
        creditsRemaining: 999,
        mediaKit: {
          create: { viewsThisWeek: 0, newOrdersCount: 0, followers: 0, engagementPct: 0 },
        },
      },
    });
  }

  const tester = await prisma.user.findUnique({ where: { email: "tester@viralyz.com" } });
  if (!tester) {
    await prisma.user.create({
      data: {
        email: "tester@viralyz.com",
        name: "Tester",
        handle: "tester",
        passwordHash: await hashPassword("tester1234"),
        plan: "credits",
        creditsRemaining: 10,
        mediaKit: {
          create: { viewsThisWeek: 0, newOrdersCount: 0, followers: 0, engagementPct: 0 },
        },
      },
    });
  }
}

export async function handleLogin(req: Request) {
  try {
    const json = await req.json();
    const parsed = loginSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    }

    const email = (
      parsed.data.demo ? "maya@viralyz.com" : (parsed.data.email ?? "")
    ).toLowerCase();
    const password = parsed.data.demo ? "demo1234" : (parsed.data.password ?? "");

    if (parsed.data.demo || email === "maya@viralyz.com" || email === "tester@viralyz.com") {
      await ensureDemoUsers();
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
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
    const json = await req.json();
    const parsed = signupSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Enter a name, valid email, and password (8+ chars)." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
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
  res.cookies.set(AUTH_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
