-- Durée de l'offre en jours : c'est cette valeur qui fait le compte à rebours
-- jour par jour, et qui est prolongée à chaque nouveau paiement.
ALTER TABLE "plans" ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 30;
