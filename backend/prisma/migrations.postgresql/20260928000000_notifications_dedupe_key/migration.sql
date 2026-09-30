-- Clé de déduplication : permet d'envoyer une alerte par produit / par jour J-n
-- au lieu d'une seule alerte par type et par jour.
ALTER TABLE "notifications" ADD COLUMN "dedupeKey" TEXT;

CREATE INDEX "notifications_storeId_type_dedupeKey_idx" ON "notifications"("storeId", "type", "dedupeKey");