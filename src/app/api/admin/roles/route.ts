import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { assignRoleDecision } from "@/lib/roles";

export const dynamic = "force-dynamic";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["user", "admin"]),
});

export async function POST(req: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Choose seller or admin." }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase();
  const decision = assignRoleDecision(auth.user, email, parsed.data.role);
  switch (decision) {
    case "ok":
      break;
    case "forbidden":
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    case "locked":
      return NextResponse.json({ error: "That account's role is locked." }, { status: 403 });
    case "invalid":
      return NextResponse.json({ error: "Choose seller or admin." }, { status: 400 });
    default: {
      const unreachable: never = decision;
      return unreachable;
    }
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }
  if (existing.role === "superadmin") {
    return NextResponse.json({ error: "That account's role is locked." }, { status: 403 });
  }

  const user = await prisma.user.update({
    where: { id: existing.id },
    data: { role: parsed.data.role },
    select: { id: true, email: true, role: true },
  });
  return NextResponse.json({ ok: true, user });
}
