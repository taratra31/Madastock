import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import type {
  ListQueryInput,
  UpdateSubscriptionInput,
} from '../validators/admin.validator';

function paging(params: ListQueryInput) {
  return {
    page: params.page,
    pageSize: params.pageSize,
    skip: (params.page - 1) * params.pageSize,
    take: params.pageSize,
  };
}

export async function getOverview() {
  const [
    storeTotal,
    storeActive,
    userTotal,
    userActive,
    subByStatus,
    payByStatus,
    successSum,
    activeSum,
    recentStores,
    recentUsers,
    recentPayments,
  ] = await Promise.all([
    prisma.store.count({ where: { deletedAt: null } }),
    prisma.store.count({ where: { deletedAt: null, active: true } }),
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, isActive: true } }),
    prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.payment.aggregate({ where: { status: 'SUCCESS' }, _sum: { amountAr: true } }),
    prisma.subscription.aggregate({ where: { status: 'ACTIVE' }, _sum: { priceAr: true } }),
    prisma.store.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        sector: true,
        city: true,
        active: true,
        createdAt: true,
        subscription: { select: { status: true, plan: { select: { name: true } } } },
      },
    }),
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        isSuperAdmin: true,
        createdAt: true,
      },
    }),
    prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        amountAr: true,
        status: true,
        merchantReference: true,
        currency: true,
        createdAt: true,
        paidAt: true,
        store: { select: { name: true } },
        plan: { select: { name: true } },
      },
    }),
  ]);

  return {
    stores: { total: storeTotal, active: storeActive, inactive: storeTotal - storeActive },
    users: { total: userTotal, active: userActive, inactive: userTotal - userActive },
    subscriptions: {
      active: subByStatus.find((s) => s.status === 'ACTIVE')?._count._all ?? 0,
      byStatus: Object.fromEntries(subByStatus.map((s) => [s.status, s._count._all])),
      mrrAr: Number(activeSum._sum.priceAr ?? 0),
    },
    payments: {
      byStatus: Object.fromEntries(payByStatus.map((s) => [s.status, s._count._all])),
      totalRevenueAr: Number(successSum._sum.amountAr ?? 0),
    },
    recent: { stores: recentStores, users: recentUsers, payments: recentPayments },
  };
}

export async function listStores(params: ListQueryInput) {
  const { page, pageSize, skip, take } = paging(params);
  const where: Prisma.StoreWhereInput = { deletedAt: null };

  if (params.q) {
    where.OR = [
      { name: { contains: params.q } },
      { city: { contains: params.q } },
    ];
  }
  if (params.sector) where.sector = params.sector;
  if (params.status === 'active') where.active = true;
  if (params.status === 'inactive') where.active = false;

  const [total, items] = await Promise.all([
    prisma.store.count({ where }),
    prisma.store.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        sector: true,
        city: true,
        country: true,
        currency: true,
        active: true,
        createdAt: true,
        _count: { select: { members: true, products: true, sales: true } },
        subscription: {
          select: {
            status: true,
            priceAr: true,
            currentPeriodEnd: true,
            plan: { select: { name: true } },
          },
        },
        members: {
          where: { isOwner: true },
          take: 1,
          select: { user: { select: { fullName: true, email: true } } },
        },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function updateStore(storeId: string, data: { active: boolean }) {
  const store = await prisma.store.findUnique({ where: { id: storeId } });
  if (!store || store.deletedAt) throw notFound('Boutique introuvable');

  return prisma.store.update({
    where: { id: storeId },
    data: { active: data.active },
    select: { id: true, name: true, active: true },
  });
}

export async function listUsers(params: ListQueryInput) {
  const { page, pageSize, skip, take } = paging(params);
  const where: Prisma.UserWhereInput = { deletedAt: null };

  if (params.q) {
    where.OR = [
      { email: { contains: params.q } },
      { fullName: { contains: params.q } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        phone: true,
        isActive: true,
        isSuperAdmin: true,
        emailVerified: true,
        createdAt: true,
        memberships: {
          select: {
            role: true,
            isOwner: true,
            store: { select: { id: true, name: true, active: true } },
          },
        },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function updateUser(
  userId: string,
  data: { isActive: boolean },
  actingUserId: string
) {
  if (userId === actingUserId && !data.isActive) {
    throw badRequest('Impossible de désactiver votre propre compte');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) throw notFound('Utilisateur introuvable');
  if (user.isSuperAdmin && !data.isActive) {
    throw badRequest('Impossible de désactiver le compte superadmin');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { isActive: data.isActive },
    select: { id: true, email: true, fullName: true, isActive: true, isSuperAdmin: true },
  });
}

export async function listSubscriptions(params: ListQueryInput) {
  const { page, pageSize, skip, take } = paging(params);
  const where: Prisma.SubscriptionWhereInput = {};

  if (params.status) where.status = params.status;
  if (params.planId) where.planId = params.planId;
  if (params.storeId) where.storeId = params.storeId;

  const [total, items] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({
      where,
      skip,
      take,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        status: true,
        priceAr: true,
        billingCycle: true,
        autoRenew: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        trialEndsAt: true,
        cancelledAt: true,
        createdAt: true,
        updatedAt: true,
        store: { select: { id: true, name: true, active: true } },
        plan: { select: { id: true, name: true, priceAr: true } },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function updateSubscription(id: string, input: UpdateSubscriptionInput) {
  const subscription = await prisma.subscription.findUnique({ where: { id } });
  if (!subscription) throw notFound('Abonnement introuvable');

  const data: Prisma.SubscriptionUpdateInput = {};

  if (input.autoRenew !== undefined) data.autoRenew = input.autoRenew;

  if (input.status) {
    data.status = input.status;
    if (input.status === 'CANCELLED') data.cancelledAt = new Date();
    if (input.status === 'ACTIVE') data.cancelledAt = null;
  }

  if (input.planId) {
    if (input.planId !== subscription.planId) {
      const plan = await prisma.plan.findUnique({ where: { id: input.planId } });
      if (!plan || !plan.isActive) throw notFound('Offre introuvable');
      data.plan = { connect: { id: plan.id } };
      data.priceAr = plan.priceAr;
      data.billingCycle = plan.billingCycle;
    }
  }

  if (Object.keys(data).length === 0) {
    throw badRequest('Aucune modification fournie');
  }

  return prisma.subscription.update({
    where: { id },
    data,
    include: {
      store: { select: { id: true, name: true } },
      plan: { select: { id: true, name: true } },
    },
  });
}

export async function listPayments(params: ListQueryInput) {
  const { page, pageSize, skip, take } = paging(params);
  const where: Prisma.PaymentWhereInput = {};

  if (params.status) where.status = params.status;
  if (params.storeId) where.storeId = params.storeId;
  if (params.planId) where.planId = params.planId;
  if (params.from || params.to) {
    where.createdAt = {
      ...(params.from ? { gte: params.from } : {}),
      ...(params.to ? { lte: params.to } : {}),
    };
  }

  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        amountAr: true,
        status: true,
        provider: true,
        currency: true,
        merchantReference: true,
        providerReference: true,
        paidAt: true,
        failedAt: true,
        createdAt: true,
        store: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}