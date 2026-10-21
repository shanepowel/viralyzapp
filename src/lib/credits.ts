import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Tx = Prisma.TransactionClient;

async function sumDeltas(tx: Tx, userId: string): Promise<number> {
  const result = await tx.creditLedger.aggregate({
    where: { userId },
    _sum: { delta: true },
  });
  return result._sum.delta ?? 0;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

export async function balance(userId: string): Promise<number> {
  return sumDeltas(prisma, userId);
}

export type LedgerEntry = { id: string; kind: string; delta: number; note: string | null; createdAt: Date };

export async function history(userId: string, take = 50): Promise<LedgerEntry[]> {
  return prisma.creditLedger.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, kind: true, delta: true, note: true, createdAt: true },
  });
}

/**
 * Reserves `amount` credits for `refId` (typically a Creative id), debiting
 * the balance immediately. Locks the user row for the duration of the
 * check-then-insert so two concurrent reserves can't both see the
 * pre-debit balance and both succeed.
 */
export async function reserve(
  userId: string,
  amount: number,
  refId: string,
): Promise<{ ok: true } | { ok: false; reason: "insufficient" }> {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`reserve: amount must be a positive integer, got ${amount}`);
  }
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw(Prisma.sql`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`);
    const bal = await sumDeltas(tx, userId);
    if (bal < amount) {
      return { ok: false, reason: "insufficient" as const };
    }
    try {
      await tx.creditLedger.create({
        data: { userId, delta: -amount, kind: "reserve", refId },
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        return { ok: false, reason: "insufficient" as const };
      }
      throw err;
    }
    return { ok: true as const };
  });
}

/**
 * Marks a reservation as finalized. The reserve's debit already stands —
 * this adds a zero-delta audit row, and is a no-op if the reservation was
 * never made, was already settled, or was already refunded.
 */
export async function settle(refId: string): Promise<void> {
  const [reserved, refunded] = await Promise.all([
    prisma.creditLedger.findUnique({ where: { refId_kind: { refId, kind: "reserve" } } }),
    prisma.creditLedger.findUnique({ where: { refId_kind: { refId, kind: "refund" } } }),
  ]);
  if (!reserved || refunded) return;

  try {
    await prisma.creditLedger.create({
      data: { userId: reserved.userId, delta: 0, kind: "settle", refId, note: "settled" },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

/**
 * Restores exactly the amount originally reserved for `refId`. Idempotent:
 * a second call (or a call for a refId that was never reserved) is a no-op.
 * The refund amount is always read back from the original reserve row, so
 * it can never exceed it.
 */
export async function refund(refId: string): Promise<void> {
  const reserved = await prisma.creditLedger.findUnique({
    where: { refId_kind: { refId, kind: "reserve" } },
  });
  if (!reserved) return;

  try {
    await prisma.creditLedger.create({
      data: {
        userId: reserved.userId,
        delta: -reserved.delta,
        kind: "refund",
        refId,
        note: "refunded",
      },
    });
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
  }
}

export async function grant(userId: string, amount: number, note: string): Promise<void> {
  await prisma.creditLedger.create({
    data: { userId, delta: amount, kind: "grant", note },
  });
}

/** Manual admin correction to a user's balance — positive or negative. */
export async function adjust(userId: string, delta: number, note: string): Promise<void> {
  if (!Number.isInteger(delta) || delta === 0) {
    throw new Error(`adjust: delta must be a nonzero integer, got ${delta}`);
  }
  await prisma.creditLedger.create({
    data: { userId, delta, kind: "adjust", note },
  });
}

/** Balances for several users in one query, keyed by userId (0 when a user has no ledger rows). */
export async function balancesFor(userIds: string[]): Promise<Record<string, number>> {
  const sums = await prisma.creditLedger.groupBy({
    by: ["userId"],
    where: { userId: { in: userIds } },
    _sum: { delta: true },
  });
  const byUser = new Map(sums.map((s) => [s.userId, s._sum.delta ?? 0]));
  return Object.fromEntries(userIds.map((id) => [id, byUser.get(id) ?? 0]));
}
