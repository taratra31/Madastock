-- CreateTable
CREATE TABLE "payment_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "amountAr" DECIMAL NOT NULL,
    "ariaryId" TEXT NOT NULL,
    "url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paidAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "payment_orders_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_orders_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "payment_orders_ariaryId_key" ON "payment_orders"("ariaryId");

-- CreateIndex
CREATE INDEX "payment_orders_storeId_idx" ON "payment_orders"("storeId");

-- CreateIndex
CREATE INDEX "payment_orders_status_idx" ON "payment_orders"("status");
