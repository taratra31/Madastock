import prisma from '../lib/prisma';
import { notFound } from '../utils/httpError';

export async function getPublicPlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      priceAr: true,
      billingCycle: true,
      durationMonths: true,
      maxUsers: true,
      maxProducts: true,
      maxWarehouses: true,
      maxCustomers: true,
      maxSalesPerMonth: true,
      featuresJson: true,
    },
    orderBy: { priceAr: 'asc' },
  });

  return plans.map(({ featuresJson, ...plan }) => {
    let features: Record<string, boolean> = {};
    try {
      const parsed = JSON.parse(featuresJson);
      if (parsed && typeof parsed === 'object') features = parsed;
    } catch {
      // JSON invalide : pas de fonctionnalités exposées
    }
    return { ...plan, features };
  });
}

export async function getPublicStore(slug: string) {
  const store = await prisma.store.findFirst({
    where: { slug, active: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      logoUrl: true,
      city: true,
      country: true,
      currency: true,
    },
  });

  if (!store) {
    throw notFound('Boutique introuvable');
  }

  return store;
}

export async function getPublicCatalogue(slug: string) {
  const store = await getPublicStore(slug);

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: { storeId: store.id, isActive: true, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        stocks: {
          where: { warehouse: { isActive: true } },
          select: { quantityAr: true, reservedQty: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.category.findMany({
      where: { storeId: store.id, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
  ]);

  return {
    store,
    products: products.map(({ stocks, ...product }) => {
      const available = stocks.reduce(
        (sum, s) => sum + Number(s.quantityAr) - Number(s.reservedQty),
        0
      );
      return {
        ...product,
        // Enlever la référence stocks de prod → garder uniquement la quantité dispo
        quantityAr: available,
        categoryName: product.category?.name ?? null,
      };
    }),
    categories: categories.map(({ id, name }) => ({ id, name })),
  };
}

export async function getPublicLiveStats(slug: string) {
  const store = await getPublicStore(slug);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const saleScope = { storeId: store.id, status: 'COMPLETED' as const };

  const [todayAgg, yesterdayAgg, totalAgg, productCount, customerCount, recent] = await Promise.all([
    prisma.sale.aggregate({
      where: { ...saleScope, createdAt: { gte: startOfToday } },
      _sum: { totalAr: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { ...saleScope, createdAt: { gte: startOfYesterday, lt: startOfToday } },
      _sum: { totalAr: true },
    }),
    prisma.sale.count({ where: saleScope }),
    prisma.product.count({ where: { storeId: store.id, isActive: true, deletedAt: null } }),
    prisma.customer.count({ where: { storeId: store.id } }),
    prisma.sale.findMany({
      where: saleScope,
      orderBy: { createdAt: 'desc' },
      take: 4,
      select: {
        id: true,
        receiptNumber: true,
        totalAr: true,
        createdAt: true,
        items: {
          take: 1,
          select: { product: { select: { name: true } } },
        },
      },
    }),
  ]);

  const todayRevenue = Number(todayAgg._sum.totalAr ?? 0);
  const yesterdayRevenue = Number(yesterdayAgg._sum.totalAr ?? 0);
  const deltaPct =
    yesterdayRevenue > 0 ? Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100) : 0;

  const week: { day: string; revenueAr: number; count: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(startOfToday);
    day.setDate(day.getDate() - i);
    const next = new Date(day);
    next.setDate(next.getDate() + 1);
    const agg = await prisma.sale.aggregate({
      where: { ...saleScope, createdAt: { gte: day, lt: next } },
      _sum: { totalAr: true },
      _count: true,
    });
    week.push({
      day: day.toLocaleDateString('fr-FR', { weekday: 'narrow' }),
      revenueAr: Number(agg._sum.totalAr ?? 0),
      count: agg._count,
    });
  }

  return {
    store: { name: store.name, slug: store.slug, city: store.city, country: store.country },
    today: { revenueAr: todayRevenue, count: todayAgg._count, deltaPct },
    counts: { sales: totalAgg, products: productCount, customers: customerCount },
    week,
    recentSales: recent.map((s) => ({
      receipt: s.receiptNumber,
      productName: s.items[0]?.product?.name ?? null,
      amountAr: Number(s.totalAr),
      at: s.createdAt,
    })),
  };
}