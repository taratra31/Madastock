import prisma from '../lib/prisma';
import { env } from '../config/env';
import { notifyOwners } from './notification.service';
import { mailerConfigured, sendLowStockEmail } from './mailer.service';
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
        dedupeKey: `J-${days} · ${sub.plan.name}`,
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
        dedupeKey: `expiré · ${store.id}`,
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
    include: {
      product: { select: { id: true, name: true, trackStock: true, lowStockThreshold: true } },
      warehouse: { select: { name: true } },
    },
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
      dedupeKey: `stock · ${stock.product!.id}`,
      since,
    });
  }
  if (alerts.length > 0) console.log(`[CRON] ${alerts.length} alerte(s) de stock bas`);

  await sendLowStockEmails(alerts, since);
}

/**
 * Un seul e-mail de synthèse par boutique et par jour : un commerçant qui a
 * 15 produits en stock bas ne doit pas recevoir 15 messages.
 */
async function sendLowStockEmails(
  alerts: Array<{
    storeId: string;
    quantityAr: unknown;
    product: { name: string; lowStockThreshold: number | null } | null;
    warehouse: { name: string } | null;
  }>,
  since: Date,
): Promise<void> {
  if (alerts.length === 0 || !mailerConfigured()) return;

  const periodKey = since.toISOString().slice(0, 10);
  const byStore = new Map<string, typeof alerts>();
  for (const a of alerts) {
    const list = byStore.get(a.storeId) ?? [];
    list.push(a);
    byStore.set(a.storeId, list);
  }

  for (const [storeId, list] of byStore) {
    const [store, members] = await Promise.all([
      prisma.store.findUnique({ where: { id: storeId }, select: { name: true } }),
      prisma.storeMember.findMany({
        where: { storeId, isOwner: true, user: { isActive: true } },
        select: { user: { select: { email: true } } },
      }),
    ]);
    if (!store) continue;

    for (const member of members) {
      const email = member.user.email;
      if (!email) continue;

      // Un envoi par destinataire et par jour : si l'insertion passe, on
      // envoie. La contrainte unique protège si deux CRF se croisent.
      try {
        await prisma.emailDispatch.create({
          data: { storeId, email, kind: 'LOW_STOCK', periodKey },
        });
      } catch {
        continue; // déjà envoyé aujourd'hui
      }

      try {
        await sendLowStockEmail(
          email,
          store.name,
          list.map((l) => ({
            productName: l.product?.name ?? '—',
            quantity: Number(l.quantityAr),
            threshold: l.product?.lowStockThreshold ?? 5,
            warehouseName: l.warehouse?.name ?? null,
          })),
        );
        console.log(`[CRON] e-mail stock bas envoyé à ${email} (${list.length} produit(s))`);
      } catch (error) {
        // Un e-mail en échec ne doit pas interrompre les tâches du jour.
        console.error('[CRON] e-mail stock bas impossible :', (error as Error).message);
        // On libère la place pour une tentative au prochain passage.
        await prisma.emailDispatch
          .delete({ where: { storeId_email_kind_periodKey: { storeId, email, kind: 'LOW_STOCK', periodKey } } })
          .catch(() => undefined);
      }
    }
  }
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
      dedupeKey: `rappel · ${r.id}`,
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

