-- Paiements Papi (remplacement du provider ariary.mg)
-- Les anciennes commandes de test ariary (lien expirés, sans valeur) sont supprimées.

DELETE FROM "payment_orders";

DROP TABLE "payment_orders";

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amountAr" DECIMAL NOT NULL,
    "merchantReference" TEXT NOT NULL,
    "provider" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'MGA',
    "notificationToken" TEXT,
    "papiReference" TEXT,
    "url" TEXT,
    "shortLink" TEXT,
    "linkExpiration" DATETIME,
    "isTestMode" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rawResponse" TEXT,
    "paidAt" DATETIME,
    "failedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payments_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_merchantReference_key" ON "payments"("merchantReference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_papiReference_key" ON "payments"("papiReference");

-- CreateIndex
CREATE INDEX "payments_storeId_idx" ON "payments"("storeId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");