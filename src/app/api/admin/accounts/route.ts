import { NextResponse } from "next/server";
import { listAccountActivity } from "@/lib/admin-accounts";
import { requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const accounts = await listAccountActivity();
  return NextResponse.json({
    accounts: accounts.map((account) => ({
      ...account,
      createdAt: account.createdAt.toISOString(),
      lastCreativeAt: account.lastCreativeAt?.toISOString() ?? null,
    })),
  });
}
