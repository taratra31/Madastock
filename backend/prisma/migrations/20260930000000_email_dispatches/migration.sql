-- Journal des envois d'e-mails automatiques (résumés d'alertes stock bas).
-- La contrainte unique empêche deux envois du même résumé le même jour
-- au même destinataire pour une même boutique.
CREATE TABLE "email_dispatches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storeId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "email_dispatches_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "email_dispatches_storeId_email_kind_periodKey_key" ON "email_dispatches"("storeId", "email", "kind", "periodKey");

CREATE INDEX "email_dispatches_storeId_idx" ON "email_dispatches"("storeId");
