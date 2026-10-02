-- L'offre gratuite est perpétuelle : « 0 Ar, pour toujours ».
--
-- Répare les boutiques gratuites que le cron avait déjà passées EXPIRED après
-- l'essai de 14 jours. Sans ce correctif, leur application est restée en
-- lecture seule (402 sur chaque écriture) alors qu'elles n'ont jamais rien
-- facturé.
--
-- Les offres payées ne sont PAS touchées : elles continuent d'expirer.

UPDATE "subscriptions" AS s
SET "status" = 'ACTIVE',
    "trialEndsAt" = NULL,
    "currentPeriodEnd" = NOW() + INTERVAL '100 years',
    "updatedAt" = NOW()
FROM "plans" AS p
WHERE s."planId" = p."id"
  AND p."priceAr" <= 0
  AND s."status" IN ('EXPIRED', 'CANCELLED', 'TRIALING');