-- CreateTable
CREATE TABLE "CreditLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditLedger_userId_idx" ON "CreditLedger"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreditLedger_refId_kind_key" ON "CreditLedger"("refId", "kind");

-- AddForeignKey
ALTER TABLE "CreditLedger" ADD CONSTRAINT "CreditLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Opening balance: give every existing user a ledger row matching their
-- current creditsRemaining column, so balance(userId) agrees with it from
-- the moment this migration runs. The column itself stays in place until
-- Task 15 retires it.
INSERT INTO "CreditLedger" ("id", "userId", "delta", "kind", "note")
SELECT gen_random_uuid()::text, "id", "creditsRemaining", 'grant', 'opening balance'
FROM "User";
