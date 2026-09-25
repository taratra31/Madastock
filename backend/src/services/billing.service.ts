import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { badRequest, notFound, HttpError } from '../utils/httpError';
import { env } from '../config/env';
import {
  createPaymentLink,
  extractPaymentId,
  getPaymentStatus,
  type AriariPaymentData,
} from './ariari.service';
import { notifyOwners } from './notification.service';
import { getSubscriptionState, nextPeriod, planDurationDays } from './subscription.service';

type PaymentRecord = Awaited<ReturnType<typeof prisma.payment.findUnique>>;

function log(action: string, detail = ''): void {
  console.log(`[${action}] ${detail}`.trimEnd());
}

export async function getOverview(storeId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { priceAr: 'asc' },
  });
  const orders = await prisma.payment.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { plan: true },
  });
  // Compte à rebours en jours : c'est ce que l'interface affiche (« J-12 »).
  const state = await getSubscriptionState(storeId);
  return { subscription, subscriptionState: state, plans, orders };
}

export async function createCheckout(storeId: string, userId: string, planId: string) {
  if (!env.ARIARI_SECRET) {
    throw badRequest('Paiement en ligne non configuré');
  }

  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw badRequest('Offre introuvable');
  if (Number(plan.priceAr) <= 0) throw badRequest('Cette offre est gratuite, aucun paiement nécessaire');

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw notFound('Boutique introuvable');

  // Le montant vient TOUJOURS de la base de données, jamais du frontend.
  const amount = Math.round(Number(plan.priceAr));
  const merchantReference = `SUB-${userId.slice(0, 8)}-${randomUUID()}`;
  const webhookUrl = env.ARIARI_WEBHOOK_URL || `${env.FRONTEND_URL}/api/webhooks/ariari`;

  const order = await prisma.payment.create({
    data: {
      storeId,
      planId,
      amountAr: plan.priceAr,
      merchantReference,
      provider: 'ARIARI',
      currency: 'MGA',
      status: 'PENDING',
    },
  });

  log('PAYMENT_CREATED', `${merchantReference} amount=${amount}`);
  log('ARIARI_REQUEST_SENT', `create payment ${merchantReference}`);

  let created: AriariPaymentData;
  try {
    created = await createPaymentLink({
      amount,
      name: `Abonnement ${plan.name} - ${store.name}`.slice(0, 120),
      redirectSuccess: `${env.FRONTEND_URL}/app/billing?status=success&ref=${merchantReference}`,
      redirectFailure: `${env.FRONTEND_URL}/app/billing?status=failed&ref=${merchantReference}`,
      silentSuccess: webhookUrl,
      silentProgress: webhookUrl,
      silentFailure: webhookUrl,
    });
  } catch (error) {
    await prisma.payment.update({
      where: { id: order.id },
      data: { status: 'FAILED', failedAt: new Date() },
    });
    log('ARIARI_ERROR', `create payment échoué ${merchantReference}`);
    throw error;
  }

  log('ARIARI_RESPONSE_RECEIVED', `payment créé ${merchantReference} id=${created.id}`);

  await prisma.payment.update({
    where: { id: order.id },
    data: {
      providerReference: created.id,
      url: created.url,
      rawResponse: JSON.stringify(created),
    },
  });

  return {
    success: true,
    reference: merchantReference,
    orderId: order.id,
    paymentLink: created.url,
  };
}

/**
 * Relecture de l'état réel d'un paiement auprès d'Ariari (source de vérité).
 * Un paiement est considéré payé UNIQUEMENT si l'API répond PAID.
 */
async function reconcile(order: PaymentRecord): Promise<void> {
  if (!order) return;
  if (!order.providerReference) {
    log('ARIARI_SKIP', `${order.merchantReference} sans id Ariari (relecture impossible)`);
    return;
  }
  log('ARIARI_REQUEST_SENT', `read-back ${order.merchantReference}`);
  const info = await getPaymentStatus(order.providerReference);
  log('ARIARI_RESPONSE_RECEIVED', `read-back ${order.merchantReference} status=${info.status}`);
  const applied = await applyNotification(order, info);
  if (applied) {
    await prisma.payment.update({
      where: { id: order.id },
      data: { url: info.url || order.url },
    });
  }
}

export async function refreshOrder(storeId: string, orderId: string) {
  const order = await prisma.payment.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId) throw notFound('Commande introuvable');

  try {
    await reconcile(order);
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    if (error.statusCode !== 400) throw error;
  }

  const updated = await prisma.payment.findUnique({
    where: { id: order.id },
    include: { plan: true },
  });
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });

  return { order: updated, subscription };
}

export async function getPaymentStatusInfo(storeId: string, merchantReference: string) {
  const payment = await prisma.payment.findUnique({ where: { merchantReference } });
  if (!payment || payment.storeId !== storeId) throw notFound('Paiement introuvable');

  if (payment.status !== 'SUCCESS' && payment.status !== 'FAILED') {
    try {
      await reconcile(payment);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      if (error.statusCode !== 400) throw error;
    }
  }

  const fresh = await prisma.payment.findUnique({
    where: { merchantReference },
    include: { plan: true },
  });
  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });
  const state = await getSubscriptionState(storeId);

  return {
    paymentStatus: fresh?.status ?? payment.status,
    provider: fresh?.provider ?? null,
    planName: fresh?.plan.name ?? null,
    subscriptionStatus: state?.status ?? subscription?.status ?? null,
    expiresAt: subscription?.currentPeriodEnd ?? null,
    daysRemaining: state?.daysRemaining ?? 0,
  };
}

/**
 * Webhook Ariari (silent* hooks : silentSuccess, silentProgress, silentFailure).
 * Pas de signature : on n'utilise QUE l'identifiant de paiement pour re-lire l'état réel
 * auprès de l'API Ariari — un attaquant ne peut pas inventer un paiement validé.
 */
export async function handleWebhook(rawBody: Buffer): Promise<{ handled: boolean }> {
  const paymentId = extractPaymentId(rawBody);
  if (!paymentId) {
    log('ARIARI_WEBHOOK_UNPARSEABLE', 'body non JSON ou sans id');
    return { handled: false };
  }

  const payment = await prisma.payment.findUnique({ where: { providerReference: paymentId } });
  if (!payment) {
    log('ARIARI_WEBHOOK_UNKNOWN', `aucune commande locale pour ${paymentId}`);
    return { handled: false };
  }

  log('ARIARI_WEBHOOK_RECEIVED', `${payment.merchantReference} id=${paymentId}`);
  try {
    const info = await getPaymentStatus(paymentId);
    const applied = await applyNotification(payment, info);
    if (applied) {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { url: info.url || payment.url },
      });
    }
  } catch (error) {
    if (!(error instanceof HttpError)) throw error;
    if (error.statusCode !== 400) throw error;
  }

  return { handled: true };
}

/**
 * Applique le statut relu à un paiement.
 * Retourne true si un changement a eu lieu.
 * Idempotent : un statut final déjà enregistré n'est jamais retraité.
 */
async function applyNotification(payment: NonNullable<PaymentRecord>, info: AriariPaymentData): Promise<boolean> {
  const ref = payment.merchantReference;

  if (info.status === 'PAID') {
    if (payment.status === 'SUCCESS') {
      log('DUPLICATE_WEBHOOK_IGNORED', `${ref} déjà SUCCESS`);
      return false;
    }
    if (Number(info.amount) !== Number(payment.amountAr)) {
      log('PAYMENT_AMOUNT_MISMATCH', `${ref} attendu=${Number(payment.amountAr)} reçu=${info.amount}`);
      return false;
    }
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const fresh = await tx.payment.findUnique({ where: { merchantReference: ref } });
      if (!fresh || fresh.status === 'SUCCESS') return;

      await tx.payment.update({
        where: { id: fresh.id },
        data: {
          status: 'SUCCESS',
          paidAt: new Date(),
          providerReference: info.id ?? fresh.providerReference,
          rawResponse: JSON.stringify(info),
        },
      });

      await activateSubscription(tx, fresh.storeId, fresh.planId, fresh.amountAr);
    });
    log('ARIARI_PAYMENT_SUCCESS', ref);
    return true;
  }

  if (info.status === 'FAILED') {
    if (payment.status === 'SUCCESS' || payment.status === 'FAILED') {
      log('DUPLICATE_WEBHOOK_IGNORED', `${ref} déjà ${payment.status}`);
      return false;
    }
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'FAILED',
        failedAt: new Date(),
        providerReference: info.id ?? payment.providerReference,
        rawResponse: JSON.stringify(info),
      },
    });
    log('ARIARI_PAYMENT_FAILED', ref);
    await notifyOwners({
      storeId: payment.storeId,
      type: 'PAYMENT_FAILED',
      title: 'Paiement non abouti',
      message: `Le paiement de ${Number(payment.amountAr).toLocaleString('fr-FR')} Ar n'a pas abouti. L'abonnement n'a pas été prolongé : vous pouvez réessayer.`,
      data: { reference: ref, to: '/billing' },
    });
    return true;
  }

  // PENDING / INCOMPLETE : pas d'activation, on garde le paiement en attente.
  if (payment.status === 'PENDING') {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        providerReference: info.id ?? payment.providerReference,
        rawResponse: JSON.stringify(info),
      },
    });
  }
  return true;
}

/**
 * Active (ou prolonge) l'abonnement dans LA MÊME transaction que le paiement PAID.
 * La durée vient du plan, en JOURS. Si l'abonnement n'est pas encore terminé, la
 * nouvelle période s'empile sur les jours restants : rien n'est perdu.
 */
async function activateSubscription(tx: Prisma.TransactionClient, storeId: string, planId: string, amountAr: Prisma.Decimal | number) {
  const plan = await tx.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw badRequest('Offre introuvable');

  const now = new Date();
  const existing = await tx.subscription.findUnique({ where: { storeId } });
  const period = nextPeriod(plan, existing, now);

  const data = {
    planId,
    status: 'ACTIVE',
    trialEndsAt: null,
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    priceAr: amountAr,
    billingCycle: plan.billingCycle,
    autoRenew: true,
    cancelledAt: null,
  };

  const subscription = await tx.subscription.upsert({
    where: { storeId },
    update: data,
    create: { storeId, ...data },
  });

  log(
    period.renewed ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_ACTIVATED',
    `store=${storeId} plan=${plan.name} ${planDurationDays(plan)}j` +
      (period.renewed ? ` (+${period.remainingDays}j restants conservés)` : '') +
      ` fin=${period.end.toISOString()}`,
  );

  // Notification hors transaction : ne doit jamais faire échouer le paiement.
  const durationDays = planDurationDays(plan);
  await notifyOwners({
    storeId,
    type: period.renewed ? 'SUBSCRIPTION_RENEWED' : 'SUBSCRIPTION_ACTIVATED',
    title: period.renewed ? 'Abonnement renouvelé' : 'Abonnement activé',
    message: period.renewed
      ? `Abonnement ${plan.name} : ${durationDays} jours ajoutés. Nouveau départ le ${period.start.toLocaleDateString('fr-FR')}, fin le ${period.end.toLocaleDateString('fr-FR')}.`
      : `Abonnement ${plan.name} activé pour ${durationDays} jours, jusqu'au ${period.end.toLocaleDateString('fr-FR')}.`,
    data: { planId, planName: plan.name, durationDays, to: '/billing' },
  });

  return subscription;
}