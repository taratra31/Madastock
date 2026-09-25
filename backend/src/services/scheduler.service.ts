import prisma from '../lib/prisma';
import { env } from '../config/env';
import { notifyOwners } from './notification.service';
import { expireDueSubscriptions, subscriptionsWithDaysLeft } from './subscription.service';

const HOUR = 60 * 60 * 1000;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Alerte J-3 et J-1 avant la fin de l'abonnement, puis abonnement expiré. */
async function runSubscriptionAlerts(now = new Date()) {
  const since = startOfToday();

  for (const days of [3, 1]) {
    const subs = await subscriptionsWithDaysLeft(days, now);
    for (const sub of subs) {
      const isTrial = sub.status === 'TRIALING';
      await notifyOwners({
        storeId: sub.storeId,
        type: 'SUBSCRIPTION_EXPIRING',
        title: isTrial ? `Votre essai se termine dans ${days} jour(s)` : `Votre abonnement expire dans ${days} jour(s)`,
        message: isTrial
          ? `L'essai gratuit de la boutique « ${sub.store.name} » se termine le ${sub.currentPeriodEnd.toLocaleDateString('fr-FR')}. Prenez un abonnement pour ne pas perdre l'accès.`
          : `L'abonnement ${sub.plan.name} de la boutique « ${sub.store.name} » se termine le ${sub.currentPeriodEnd.toLocaleDateString('fr-FR')}. Renouvelez pour continuer sans interruption.`,
        data: { daysLeft: days, planId: sub.planId, planName: sub.plan.name, status: sub.status, to: '/billing' },
        since,
      });
    }
  }

  const expired = await expireDueSubscriptions(now);
  if (expired.length > 0) {
    const stores = await prisma.store.findMany({ where: { id: { in: expired } }, select: { id: true, name: true } });
    for (const store of stores) {
      await notifyOwners({
        storeId: store.id,
        type: 'SUBSCRIPTION_EXPIRED',
        title: 'Abonnement expiré',
        message: `L'abonnement de la boutique « ${store.name} » est arrivé à terme. Vos données sont conservées : renouvelez pour reprendre.`,
        data: { to: '/billing' },
        since,
      });
    }
    console.log(`[CRON] ${expired.length} abonnement(s) passé(s) EXPIRED`);
  }
}

/** Produits sous le seuil d'alerte défini sur la fiche produit. */
async function runLowStockAlerts() {
  const since = startOfToday();
  const lows = await prisma.stock.findMany({
    where: { warehouse: { store: { active: true } }, product: { is: { isActive: true } } },
    include: { product: { select: { id: true, name: true, trackStock: true, lowStockThreshold: true } } },
    take: 1000,
  });

  const alerts = lows
    .filter(
      (s) =>
        s.product &&
        s.product.trackStock &&
        !s.isShared &&
        Number(s.quantityAr) <= (s.product.lowStockThreshold ?? 5),
    )
    .slice(0, 20);

  for (const stock of alerts) {
    const threshold = stock.product!.lowStockThreshold ?? 5;
    await notifyOwners({
      storeId: stock.storeId,
      type: 'LOW_STOCK',
      title: `Stock bas : ${stock.product!.name}`,
      message: `Il reste ${Number(stock.quantityAr)} unité(s) de « ${stock.product!.name} » (seuil d'alerte : ${threshold}).`,
      data: {
        productId: stock.product!.id,
        productName: stock.product!.name,
        quantity: Number(stock.quantityAr),
        minStock: threshold,
        to: '/stock',
      },
      since,
    });
  }
  if (alerts.length > 0) console.log(`[CRON] ${alerts.length} alerte(s) de stock bas`);
}

/** Rappels CRM du jour. */
async function runReminderAlerts() {
  const since = startOfToday();
  const endOfDay = new Date(since.getTime() + 24 * HOUR);
  const reminders = await prisma.reminder.findMany({
    where: {
      status: { in: ['PENDING', 'SENT'] },
      remindAt: { gte: since, lt: endOfDay },
    },
    include: { customer: { select: { firstName: true, lastName: true } } },
    take: 50,
  });

  for (const r of reminders) {
    const who = r.customer ? `${r.customer.firstName ?? ''} ${r.customer.lastName ?? ''}`.trim() : 'un contact';
    await notifyOwners({
      storeId: r.storeId,
      type: 'REMINDER_DUE',
      title: r.title,
      message: `Rappel du jour : ${r.message ?? who}`,
      data: { reminderId: r.id, to: '/reminders' },
      since,
    });
  }
  if (reminders.length > 0) console.log(`[CRON] ${reminders.length} rappel(s) du jour`);
}

let timer: NodeJS.Timeout | null = null;
let running = false;

export async function runDailyJobs(): Promise<void> {
  if (running) return;
  running = true;
  const started = Date.now();
  try {
    await runSubscriptionAlerts();
    await runLowStockAlerts();
    await runReminderAlerts();
    console.log(`[CRON] tâches quotidiennes terminées en ${Date.now() - started} ms`);
  } catch (error) {
    console.error('[CRON] échec des tâches quotidiennes :', (error as Error).message);
  } finally {
    running = false;
  }
}

/**
 * Tâches de fond. Sur Render (off), le conteneur peut être gelé : on espace
 * donc les passages et on ne dépend pas d'un cron externe.
 */
export function startScheduler(): void {
  if (env.NODE_ENV === 'test') return;
  const everyMs = 6 * HOUR;

  const tick = () => {
    void runDailyJobs();
  };

  // Premier passage légèrement différé pour ne pas concurrencer le démarrage.
  setTimeout(tick, 20_000).unref?.();
  timer = setInterval(tick, everyMs);
  timer.unref?.();
  console.log(`[CRON] planificateur démarré (toutes les ${everyMs / HOUR} h)`);
}

export function stopScheduler(): void {
  if (timer) clearInterval(timer);
  timer = null;
}

