import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE, sessionCookieValue } from "@/lib/auth";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  demo: z.boolean().optional(),
});

/** Demo auth — accepts any credentials; Maya demo shortcut supported. */
export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    }

    const { email, demo } = parsed.data;
    const user = demo
      ? { email: "maya@viralyz.com", name: "Maya R." }
      : {
          email,
          name: email.split("@")[0]?.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Creator",
        };

    const res = NextResponse.json({ ok: true, user });
    res.cookies.set(AUTH_COOKIE, sessionCookieValue(user), {
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
