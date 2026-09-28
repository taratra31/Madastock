-- Boutique interne (admin/demo) : aucun paiement, jamais d'expiration.
ALTER TABLE "stores" ADD COLUMN "billingExempt" BOOLEAN NOT NULL DEFAULT false;