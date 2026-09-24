-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "productId" TEXT,
    "basePlanId" TEXT,
    "status" TEXT NOT NULL,
    "startsAt" REAL NOT NULL,
    "expiresAt" REAL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "grantedBy" TEXT,
    "purchaseToken" TEXT,
    "createdAt" REAL NOT NULL,
    "updatedAt" REAL NOT NULL,
    CONSTRAINT "Entitlement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "details" TEXT NOT NULL,
    "createdAt" REAL NOT NULL
);

-- AlterTable (additive: existing rows keep their data; role defaults to 'user')
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
ALTER TABLE "User" ADD COLUMN "disabledAt" REAL;
ALTER TABLE "User" ADD COLUMN "lastSyncAt" REAL;

-- CreateIndex
CREATE UNIQUE INDEX "Entitlement_purchaseToken_key" ON "Entitlement"("purchaseToken");

-- CreateIndex
CREATE INDEX "Entitlement_userId_idx" ON "Entitlement"("userId");

-- CreateIndex
CREATE INDEX "Entitlement_status_idx" ON "Entitlement"("status");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
