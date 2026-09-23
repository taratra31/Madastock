-- Durée des plans (utilisée pour l'activation/renouvellement des abonnements)
ALTER TABLE "plans" ADD COLUMN "durationMonths" INTEGER NOT NULL DEFAULT 1;