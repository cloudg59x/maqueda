-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('BELOW_THRESHOLD', 'BACK_ABOVE', 'BALANCE_CHANGED', 'WORKER_ERROR');

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT "Session_userId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_clientId_fkey";

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "belowThreshold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastBalanceUsd" DECIMAL(18,2),
ADD COLUMN     "lastCheckedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "actor" TEXT NOT NULL DEFAULT 'system',
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "details" TYPE JSONB USING CASE WHEN "details" IS NULL THEN NULL ELSE "details"::jsonb END;

-- CreateTable
CREATE TABLE "MonitoredToken" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "decimals" INTEGER NOT NULL,
    "coingeckoId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MonitoredToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BalanceSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "rawBalance" DECIMAL(78,0) NOT NULL,
    "usdValue" DECIMAL(18,2) NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BalanceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "type" "AlertType" NOT NULL,
    "message" TEXT NOT NULL,
    "payload" JSONB,
    "readAt" TIMESTAMP(3),
    "notifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "WorkerState" (
    "id" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastDurationMs" INTEGER,
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkerState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredToken_chainId_symbol_key" ON "MonitoredToken"("chainId", "symbol");

-- CreateIndex
CREATE INDEX "BalanceSnapshot_clientId_tokenId_takenAt_idx" ON "BalanceSnapshot"("clientId", "tokenId", "takenAt");

-- CreateIndex
CREATE INDEX "Alert_readAt_idx" ON "Alert"("readAt");

-- CreateIndex
CREATE INDEX "Alert_clientId_createdAt_idx" ON "Alert"("clientId", "createdAt");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BalanceSnapshot" ADD CONSTRAINT "BalanceSnapshot_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "MonitoredToken"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

