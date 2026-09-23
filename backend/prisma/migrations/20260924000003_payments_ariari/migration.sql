-- Bascule paiements vers ariari.mg (provider Ariari).
-- L'identifiant externe du paiement (id Ariari) devient "providerReference".
-- Les colonnes Papi (notificationToken, shortLink, linkExpiration, isTestMode) sont inutilisées : retirées.
ALTER TABLE "payments" RENAME COLUMN "papiReference" TO "providerReference";
DROP INDEX "payments_papiReference_key";
CREATE UNIQUE INDEX "payments_providerReference_key" ON "payments"("providerReference");
ALTER TABLE "payments" DROP COLUMN "notificationToken";
ALTER TABLE "payments" DROP COLUMN "shortLink";
ALTER TABLE "payments" DROP COLUMN "linkExpiration";
ALTER TABLE "payments" DROP COLUMN "isTestMode";