import type { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { forbidden, paymentRequired } from '../utils/httpError';

/** Statuts qui consomment encore du temps d'abonnement. */
const LIVE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

export type PlanContext = {
  billingExempt: boolean;
  isLive: boolean;
  features: Record<string, boolean>;
  planName: string | null;
};

/**
 * Charge l'abonnement de la boutique attachée à la requête et calcule le
 * contexte de licence courante. Une boutique SANS ligne d'abonnement est
 * considérée ouverte (jamais verrouillée) pour ne jamais bloquer une boutique
 * en sortie d'erreur de configuration.
 */
export async function loadPlan(storeId: string): Promise<PlanContext> {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    include: { plan: true, store: { select: { billingExempt: true } } },
  });

  const billingExempt = subscription?.store.billingExempt ?? false;

  // Pas d'abonnement : boutique considérée ouverte (jamais verrouillée) pour
  // ne jamais piéger une boutique en sortie d'erreur de configuration.
  let isLive = billingExempt || !subscription;
  if (subscription && !billingExempt) {
    isLive =
      LIVE_STATUSES.includes(subscription.status) &&
      new Date(subscription.currentPeriodEnd).getTime() > Date.now();
  }

  let features: Record<string, boolean> = {};
  if (subscription?.plan.featuresJson) {
    try {
      const parsed: unknown = JSON.parse(subscription.plan.featuresJson);
      if (parsed && typeof parsed === 'object') {
        features = parsed as Record<string, boolean>;
      }
    } catch {
      features = {};
    }
  }

  return {
    billingExempt,
    isLive,
    features,
    planName: subscription?.plan.name ?? null,
  };
}

/**
 * Le super administrateur de la plateforme n'est jamais soumis à l'abonnement :
 * il doit pouvoir piloter toutes les boutiques (y compris expirées) pour
 * dépanner, prolonger un essai ou exonérer une boutique depuis le back-office.
 */
async function isPlatformAdmin(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isSuperAdmin: true, isActive: true, deletedAt: true },
  });
  return Boolean(user?.isSuperAdmin && user.isActive && !user.deletedAt);
}

/**
 * Abonnement expiré (ou annulé) : le compte passe en « lecture seule ».
 * - Les lectures (GET/HEAD) restent autorisées : l'utilisateur garde l'accès
 *   à ses données et comprend pourquoi il doit renouveler.
 * - Toute écriture (création, modification, suppression) est refusée en 402
 *   et le frontend ouvre la modale d'abonnement.
 * Exceptions : une boutique interne (admin/démo), une boutique encore en période
 * valide (essai gratuit compris) et le super administrateur de la plateforme.
 */
export async function requireLiveWrite(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.store) return next(forbidden('Contexte boutique manquant'));

  const context = await loadPlan(req.store.id);
  if (context.billingExempt || context.isLive) return next();

  const method = (req.method ?? 'GET').toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  // Vérifié uniquement au moment de bloquer : aucun surcoût pour les boutiques à jour.
  if (req.user && (await isPlatformAdmin(req.user.id))) return next();

  return next(
    paymentRequired(
      'Votre abonnement a expiré. Renouvelez-le pour continuer à utiliser MadaStock.',
    ),
  );
}