import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

/** Durée de l'essai gratuit d'une nouvelle boutique, en jours. */
export const TRIAL_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuts qui encore « consomment » du temps d'abonnement. */
const LIVE_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE'];

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Nombre de jours entiers restants (0 dès que la période est terminée).
 * Plancher et non arrondi : un abonnement qui finit dans 1 j 2 h affiche « J-1 »,
 * ce qui est cohérent avec la fenêtre J-n de `subscriptionsWithDaysLeft`.
 */
export function daysLeft(periodEnd: Date | null | undefined, now = new Date()): number {
  if (!periodEnd) return 0;
  const diff = new Date(periodEnd).getTime() - now.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / DAY_MS);
}

export function planDurationDays(plan: { durationDays?: number | null; durationMonths?: number | null }): number {
  if (plan.durationDays && plan.durationDays > 0) return plan.durationDays;
  const months = plan.durationMonths && plan.durationMonths > 0 ? plan.durationMonths : 1;
  return months * 30;
}

type SubscriptionRow = {
  status: string;
  currentPeriodEnd: Date;
  currentPeriodStart: Date;
  trialEndsAt: Date | null;
};

export type Period = {
  start: Date;
  end: Date;
  /** true quand on a empilé la nouvelle période sur les jours restants. */
  renewed: boolean;
  /** Jours restants avant le début de la nouvelle période (0 si elle démarre maintenant). */
  remainingDays: number;
};

/**
 * Calcule la période qui suit un paiement.
 * - Si l'abonnement n'est pas encore terminé, la nouvelle période COMMENCE à la
 *   fin de l'ancienne : les jours restants ne sont jamais perdus.
 * - Sinon elle commence maintenant.
 * La durée vient du plan, en jours.
 */
export function nextPeriod(
  plan: { durationDays?: number | null; durationMonths?: number | null },
  existing: SubscriptionRow | null | undefined,
  now = new Date(),
): Period {
  const durationDays = planDurationDays(plan);
  const stillRunning =
    !!existing &&
    LIVE_STATUSES.includes(existing.status) &&
    new Date(existing.currentPeriodEnd).getTime() > now.getTime();

  if (stillRunning) {
    const start = new Date(existing!.currentPeriodEnd);
    return {
      start,
      end: addDays(start, durationDays),
      renewed: true,
      remainingDays: daysLeft(existing!.currentPeriodEnd, now),
    };
  }

  return { start: now, end: addDays(now, durationDays), renewed: false, remainingDays: 0 };
}

/** Période d'essai d'une nouvelle boutique. */
export function trialPeriod(now = new Date()): Period {
  const end = addDays(now, TRIAL_DAYS);
  return { start: now, end, renewed: false, remainingDays: TRIAL_DAYS };
}

/** true si l'abonnement est encore valable à la date donnée. */
export function isLive(subscription: SubscriptionRow | null | undefined, now = new Date()): boolean {
  if (!subscription) return false;
  if (subscription.status === 'CANCELLED' || subscription.status === 'EXPIRED') return false;
  return new Date(subscription.currentPeriodEnd).getTime() > now.getTime();
}

/**
 * États des abonnements dont la période est terminée : on les passe EXPIRED.
 * Retourne les boutiques concernées pour pouvoir notifier leurs propriétaires.
 */
export async function expireDueSubscriptions(now = new Date()): Promise<string[]> {
  const due = await prisma.subscription.findMany({
    where: {
      status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
      currentPeriodEnd: { lte: now },
    },
    select: { id: true, storeId: true },
  });
  if (due.length === 0) return [];

  await prisma.subscription.updateMany({
    where: { id: { in: due.map((s) => s.id) } },
    data: { status: 'EXPIRED' },
  });
  return [...new Set(due.map((s) => s.storeId))];
}

/**
 * Abonnements dont il reste exactement `days` jours.
 * daysLeft = ceil(reste / DAY) donc « J-n » équivaut à
 * (n-1) jours < reste <= n jours.
 */
export async function subscriptionsWithDaysLeft(days: number, now = new Date()) {
  return prisma.subscription.findMany({
    where: {
      status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] },
      currentPeriodEnd: { gt: addDays(now, days - 1), lte: addDays(now, days) },
    },
    include: { plan: true, store: { select: { id: true, name: true } } },
  });
}

/**
 * Vue complète de l'abonnement d'une boutique : statut réel + compte à rebours.
 * `status` est corrigé à la volée si la date de fin est passée (aucun cron requis
 * pour que l'interface soit juste).
 */
export async function getSubscriptionState(storeId: string, now = new Date()) {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });
  if (!subscription) return null;

  const expired =
    LIVE_STATUSES.includes(subscription.status) &&
    new Date(subscription.currentPeriodEnd).getTime() <= now.getTime();

  const status = expired ? 'EXPIRED' : subscription.status;
  const remaining = daysLeft(subscription.currentPeriodEnd, now);
  const trialRemaining = subscription.trialEndsAt ? daysLeft(subscription.trialEndsAt, now) : 0;
  const total = status === 'TRIALING' && trialRemaining > 0 ? TRIAL_DAYS : planDurationDays(subscription.plan);

  return {
    id: subscription.id,
    storeId: subscription.storeId,
    planId: subscription.planId,
    planName: subscription.plan.name,
    planPriceAr: Number(subscription.plan.priceAr),
    durationDays: planDurationDays(subscription.plan),
    status,
    storedStatus: subscription.status,
    isExpired: status === 'EXPIRED' || status === 'CANCELLED',
    isLive: LIVE_STATUSES.includes(status),
    isTrial: status === 'TRIALING',
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    trialEndsAt: subscription.trialEndsAt,
    daysRemaining: remaining,
    daysTotal: total,
    /** Part de la période encore restante, 0-100 (barre du compte à rebours). */
    remainingPercent:
      new Date(subscription.currentPeriodEnd).getTime() > new Date(subscription.currentPeriodStart).getTime()
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                ((new Date(subscription.currentPeriodEnd).getTime() - now.getTime()) /
                  (new Date(subscription.currentPeriodEnd).getTime() - new Date(subscription.currentPeriodStart).getTime())) *
                  100,
              ),
            ),
          )
        : 100,
    trialDaysRemaining: trialRemaining,
    autoRenew: subscription.autoRenew,
    cancelledAt: subscription.cancelledAt,
  };
}

/** Jours restants + statut, sans requête supplémentaire (à partir d'une ligne). */
export function summarize(subscription: SubscriptionRow | null | undefined, now = new Date()) {
  if (!subscription) return { status: null, daysRemaining: 0, isExpired: true };
  const remaining = daysLeft(subscription.currentPeriodEnd, now);
  const expired = LIVE_STATUSES.includes(subscription.status) && remaining === 0;
  return {
    status: expired ? 'EXPIRED' : subscription.status,
    daysRemaining: remaining,
    isExpired: expired || subscription.status === 'EXPIRED' || subscription.status === 'CANCELLED',
  };
}

export type Tx = Prisma.TransactionClient | typeof prisma;
