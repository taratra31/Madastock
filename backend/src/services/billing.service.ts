import Ariari, { Status } from '@ariary/pay';
import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import { env } from '../config/env';

let configured = false;

function api() {
  if (!env.ARIARY_SECRET) {
    throw badRequest('Paiement en ligne non configuré');
  }
  if (!configured) {
    Ariari.config({ secret: env.ARIARY_SECRET, baseUrl: env.ARIARY_BASE_URL });
    configured = true;
  }
  return Ariari;
}

function webhookUrl() {
  return `${env.FRONTEND_URL}/api/v1/billing/webhook`;
}

function toDbStatus(s: string | undefined): string {
  switch (s) {
    case Status.PAID:
      return 'PAID';
    case Status.INCOMPLETE:
      return 'INCOMPLETE';
    case Status.FAILED:
      return 'FAILED';
    default:
      return 'PENDING';
  }
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
  const orders = await prisma.paymentOrder.findMany({
    where: { storeId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { plan: true },
  });
  return { subscription, plans, orders };
}

export async function createCheckout(storeId: string, planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw badRequest('Offre introuvable');
  if (Number(plan.priceAr) <= 0) throw badRequest("Cette offre est gratuite, aucune commande nécessaire");

  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store) throw notFound('Boutique introuvable');

  const amount = Number(plan.priceAr);
  const hooks = {
    redirectSuccess: `${env.FRONTEND_URL}/app/billing?status=success`,
    redirectFailure: `${env.FRONTEND_URL}/app/billing?status=failed`,
    silentSuccess: webhookUrl(),
    silentProgress: webhookUrl(),
    silentFailure: webhookUrl(),
  };

  const payment = await api().create({
    amount,
    name: `Abonnement ${plan.name} - ${store.name}`,
    imgUrl: `${env.FRONTEND_URL}/logo-madastock.png`,
    hooks,
  });

  const order = await prisma.paymentOrder.create({
    data: {
      storeId,
      planId,
      amountAr: plan.priceAr,
      ariaryId: payment.id,
      url: payment.url ?? null,
      status: 'PENDING',
    },
    include: { plan: true },
  });

  return { orderId: order.id, url: payment.url ?? null };
}

export async function refreshOrder(storeId: string, orderId: string) {
  const order = await prisma.paymentOrder.findUnique({ where: { id: orderId } });
  if (!order || order.storeId !== storeId) throw notFound('Commande introuvable');

  const payment = api().getPayment(order.ariaryId);
  const info = await payment.status();
  const dbStatus = toDbStatus(info.status);

  if (dbStatus === 'PAID' && order.status !== 'PAID') {
    await activateSubscription(storeId, order.planId, order.amountAr);
  }

  const updated = await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { status: dbStatus, paidAt: dbStatus === 'PAID' ? new Date() : undefined, url: info.url },
    include: { plan: true },
  });

  const subscription = await prisma.subscription.findUnique({
    where: { storeId },
    include: { plan: true },
  });

  return { order: updated, subscription };
}

export async function handleWebhook(body: Record<string, unknown>) {
  const root = body as { payment?: { id?: string }; id?: string; data?: { id?: string } };
  const paymentId = root.payment?.id ?? root.id ?? root.data?.id;
  if (!paymentId) {
    return { handled: false };
  }

  const order = await prisma.paymentOrder.findUnique({ where: { ariaryId: paymentId } });
  if (!order) {
    return { handled: false };
  }

  const payment = api().getPayment(paymentId);
  const info = await payment.status();
  const dbStatus = toDbStatus(info.status);

  if (dbStatus === 'PAID' && order.status !== 'PAID') {
    await activateSubscription(order.storeId, order.planId, order.amountAr);
  }

  await prisma.paymentOrder.update({
    where: { id: order.id },
    data: { status: dbStatus, paidAt: dbStatus === 'PAID' ? new Date() : undefined, url: info.url },
  });

  return { handled: true };
}

async function activateSubscription(storeId: string, planId: string, priceAr: unknown) {
  const now = new Date();
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);

  await prisma.subscription.upsert({
    where: { storeId },
    update: {
      planId,
      status: 'ACTIVE',
      trialEndsAt: null,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      priceAr: priceAr as never,
      autoRenew: true,
      cancelledAt: null,
    },
    create: {
      storeId,
      planId,
      status: 'ACTIVE',
      trialEndsAt: null,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      priceAr: priceAr as never,
      billingCycle: 'MONTHLY',
      autoRenew: true,
    },
  });
}