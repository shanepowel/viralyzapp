import { NextResponse } from "next/server";
import { z } from "zod";
import { getClerkIdentity, upsertUserFromClerk } from "@/lib/users";

export const dynamic = "force-dynamic";

const schema = z.object({
  inviteCode: z.string().min(4).max(32),
});

export async function POST(req: Request) {
  const clerk = await getClerkIdentity();
  if (!clerk) {
    return NextResponse.json({ error: "Sign in with SSO first." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid invite code." }, { status: 400 });
  }

  const user = await upsertUserFromClerk({
    clerkUserId: clerk.clerkUserId,
    email: clerk.email,
    name: clerk.name,
    inviteCode: parsed.data.inviteCode,
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid or expired invite code." }, { status: 403 });
  }

  return NextResponse.json({ ok: true, user: { id: user.id, email: user.email } });
}
