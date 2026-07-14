import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, sessionCookieValue, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  demo: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    }

    const email = parsed.data.demo ? "maya@viralyz.com" : parsed.data.email.toLowerCase();
    const password = parsed.data.demo ? "demo1234" : parsed.data.password;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

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
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
