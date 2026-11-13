import { prisma } from "@/lib/prisma";

type CreativeStatus = "pending" | "generating" | "ready" | "failed";

export type CreativeCounts = Record<CreativeStatus, number>;

export type AccountActivity = {
  id: string;
  email: string;
  name: string;
  role: string;
  plan: string;
  createdAt: Date;
  onboardingDone: boolean;
  balance: number;
  brandCount: number;
  creatives: CreativeCounts;
  lastCreativeAt: Date | null;
};

function emptyCounts(): CreativeCounts {
  return { pending: 0, generating: 0, ready: 0, failed: 0 };
}

/**
 * Operational picture of accounts: who they are, their credit balance, and
 * how many creatives exist in each status. Ad copy, files, and results stay
 * on the account that owns them.
 */
export async function listAccountActivity(limit = 100): Promise<AccountActivity[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      plan: true,
      createdAt: true,
      onboardingDone: true,
    },
  });
  if (users.length === 0) return [];

  const ids = users.map((user) => user.id);
  const [sums, brands, creatives, latest] = await Promise.all([
    prisma.creditLedger.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _sum: { delta: true },
    }),
    prisma.brand.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.creative.groupBy({
      by: ["userId", "status"],
      where: { userId: { in: ids } },
      _count: { _all: true },
    }),
    prisma.creative.groupBy({
      by: ["userId"],
      where: { userId: { in: ids } },
      _max: { updatedAt: true },
    }),
  ]);

  const balanceByUser = new Map(sums.map((row) => [row.userId, row._sum.delta ?? 0]));
  const brandsByUser = new Map(brands.map((row) => [row.userId, row._count._all]));
  const countsByUser = new Map<string, CreativeCounts>();
  for (const row of creatives) {
    const counts = countsByUser.get(row.userId) ?? emptyCounts();
    const status = row.status as CreativeStatus | string;
    switch (status) {
      case "pending":
      case "generating":
      case "ready":
      case "failed":
        counts[status] = row._count._all;
        break;
      default:
        break;
    }
    countsByUser.set(row.userId, counts);
  }
  const latestByUser = new Map(latest.map((row) => [row.userId, row._max.updatedAt]));

  return users.map((user) => ({
    ...user,
    balance: balanceByUser.get(user.id) ?? 0,
    brandCount: brandsByUser.get(user.id) ?? 0,
    creatives: countsByUser.get(user.id) ?? emptyCounts(),
    lastCreativeAt: latestByUser.get(user.id) ?? null,
  }));
}
