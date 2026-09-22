import prisma from '../lib/prisma';

export async function getDashboardStats(storeId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(now.getTime() - 86400000);
  const startOfYesterday = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const [
    productCount, categoryCount, customerCount, warehouseCount, supplierCount,
    salesTotals, monthSales, todaySales, yesterdaySales, weekSales,
    unitStats,
  ] = await Promise.all([
    prisma.product.count({ where: { storeId, isActive: true, deletedAt: null } }),
    prisma.category.count({ where: { storeId, isActive: true } }),
    prisma.customer.count({ where: { storeId, isActive: true } }),
    prisma.warehouse.count({ where: { storeId, isActive: true } }),
    prisma.supplier.count({ where: { storeId, isActive: true } }),
    prisma.sale.aggregate({
      where: { storeId, status: 'COMPLETED', cancelledAt: null },
      _sum: { totalAr: true, discountAr: true, taxAr: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { storeId, status: 'COMPLETED', cancelledAt: null, createdAt: { gte: startOfMonth } },
      _sum: { totalAr: true, discountAr: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { storeId, status: 'COMPLETED', cancelledAt: null, createdAt: { gte: startOfToday } },
      _sum: { totalAr: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { storeId, status: 'COMPLETED', cancelledAt: null, createdAt: { gte: startOfYesterday, lt: startOfToday } },
      _sum: { totalAr: true },
      _count: true,
    }),
    prisma.sale.aggregate({
      where: { storeId, status: 'COMPLETED', cancelledAt: null, createdAt: { gte: startOfWeek } },
      _sum: { totalAr: true },
      _count: true,
    }),
    prisma.stock.aggregate({
      where: { storeId },
      _sum: { quantityAr: true, reservedQty: true },
    }),
  ]);

  const [lowStockProducts, topProductsData, recentSales, recentMovements,
    categoryStats, weeklySalesByDay, salesByPaymentMethod] = await Promise.all([
    prisma.stock.findMany({
      where: { storeId },
      include: {
        product: {
          select: { id: true, name: true, imageUrl: true, lowStockThreshold: true, trackStock: true, sellingPriceAr: true },
        },
      },
    }).then(stocks =>
      stocks
        .filter(s => s.product?.trackStock && Number(s.quantityAr) <= (s.product.lowStockThreshold ?? 5))
        .map(s => ({
          productId: s.product!.id,
          name: s.product!.name,
          imageUrl: s.product!.imageUrl,
          currentStock: Number(s.quantityAr),
          threshold: s.product!.lowStockThreshold ?? 5,
          sellingPriceAr: Number(s.product!.sellingPriceAr),
        }))
        .sort((a, b) => a.currentStock - b.currentStock)
    ),
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: { storeId, status: 'COMPLETED', cancelledAt: null },
        productId: { not: null },
      },
      _sum: { quantityAr: true, lineTotalAr: true, costPriceAr: true },
      _count: true,
      orderBy: { _sum: { lineTotalAr: 'desc' } },
      take: 8,
    }),
    prisma.sale.findMany({
      where: { storeId, status: 'COMPLETED', cancelledAt: null },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, imageUrl: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.stockMovement.findMany({
      where: { storeId },
      include: {
        product: { select: { id: true, name: true, imageUrl: true } },
        warehouse: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.product.groupBy({
      by: ['categoryId'],
      where: { storeId, isActive: true, deletedAt: null },
      _count: true,
      _avg: { sellingPriceAr: true },
    }),
    // Sales by day of week for current week
    Promise.all(
      Array.from({ length: 7 }, (_, i) => {
        const day = new Date(startOfWeek);
        day.setDate(day.getDate() + i);
        const nextDay = new Date(day);
        nextDay.setDate(day.getDate() + 1);
        return prisma.sale.aggregate({
          where: {
            storeId,
            status: 'COMPLETED',
            cancelledAt: null,
            createdAt: { gte: day, lt: nextDay },
          },
          _sum: { totalAr: true },
          _count: true,
        }).then(r => ({
          day: day.toLocaleDateString('fr-FR', { weekday: 'short' }),
          revenue: Number(r._sum.totalAr ?? 0),
          count: r._count,
        }));
      })
    ),
    prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: { storeId, status: 'COMPLETED', cancelledAt: null },
      _sum: { totalAr: true },
      _count: true,
      orderBy: { _sum: { totalAr: 'desc' } },
    }),
  ]);

  const topProductNames = await prisma.product.findMany({
    where: { id: { in: topProductsData.map(t => t.productId as string) } },
    select: { id: true, name: true, imageUrl: true, sellingPriceAr: true, costPriceAr: true },
  });

  const categoryNames = await prisma.category.findMany({
    where: { storeId },
    select: { id: true, name: true },
  });

  // Compute stock value
  const allStocks = await prisma.stock.findMany({
    where: { storeId },
    include: { product: { select: { costPriceAr: true } } },
  });
  const totalStockValueAr = allStocks.reduce(
    (sum, s) => sum + Number(s.quantityAr) * Number(s.product?.costPriceAr ?? 0), 0
  );

  const avgSaleAr = salesTotals._count > 0
    ? Number(salesTotals._sum.totalAr ?? 0) / salesTotals._count
    : 0;

  const totalProfitMonth = topProductsData.reduce((sum, t) => {
    const prod = topProductNames.find(p => p.id === t.productId);
    if (!prod) return sum;
    const profitPerUnit = Number(prod.sellingPriceAr) - Number(prod.costPriceAr);
    return sum + profitPerUnit * Number(t._sum.quantityAr ?? 0);
  }, 0);

  return {
    counts: {
      products: productCount,
      categories: categoryCount,
      customers: customerCount,
      warehouses: warehouseCount,
      suppliers: supplierCount,
      lowStock: lowStockProducts.length,
    },
    totalStockUnits: Number(unitStats._sum.quantityAr ?? 0),
    totalReservedUnits: Number(unitStats._sum.reservedQty ?? 0),
    totalStockValueAr,
    avgSaleAr,
    totalProfitMonth,
    sales: {
      allTime: { revenueAr: Number(salesTotals._sum.totalAr ?? 0), discountAr: Number(salesTotals._sum.discountAr ?? 0), taxAr: Number(salesTotals._sum.taxAr ?? 0), count: salesTotals._count },
      month: { revenueAr: Number(monthSales._sum.totalAr ?? 0), discountAr: Number(monthSales._sum.discountAr ?? 0), count: monthSales._count },
      today: { revenueAr: Number(todaySales._sum.totalAr ?? 0), count: todaySales._count },
      yesterday: { revenueAr: Number(yesterdaySales._sum.totalAr ?? 0), count: yesterdaySales._count },
      week: { revenueAr: Number(weekSales._sum.totalAr ?? 0), count: weekSales._count },
    },
    lowStockProducts,
    weeklySalesByDay,
    salesByPaymentMethod: salesByPaymentMethod.map(p => ({
      method: p.paymentMethod,
      revenueAr: Number(p._sum.totalAr ?? 0),
      count: p._count,
    })),
    categoryStats: categoryStats.map(c => ({
      categoryId: c.categoryId,
      name: categoryNames.find(n => n.id === c.categoryId)?.name ?? '—',
      productCount: c._count,
      avgPriceAr: Number(c._avg.sellingPriceAr ?? 0),
    })),
    recentSales: recentSales.map(s => ({
      id: s.id,
      receiptNumber: s.receiptNumber,
      totalAr: Number(s.totalAr),
      status: s.status,
      paymentMethod: s.paymentMethod,
      createdAt: s.createdAt,
      itemsCount: s.items.length,
    })),
    topProducts: topProductsData.map(t => {
      const prod = topProductNames.find(p => p.id === t.productId);
      return {
        productId: t.productId,
        name: prod?.name ?? '—',
        imageUrl: prod?.imageUrl ?? null,
        sellingPriceAr: prod ? Number(prod.sellingPriceAr) : 0,
        costPriceAr: prod ? Number(prod.costPriceAr) : 0,
        quantitySold: Number(t._sum.quantityAr ?? 0),
        revenueAr: Number(t._sum.lineTotalAr ?? 0),
        costAr: Number(t._sum.costPriceAr ?? 0),
        orderCount: t._count,
      };
    }),
    recentMovements: recentMovements.map(m => ({
      id: m.id,
      type: m.movementType,
      quantity: Number(m.quantity),
      productName: m.product?.name ?? null,
      imageUrl: m.product?.imageUrl ?? null,
      warehouseName: m.warehouse.name,
      reason: m.reason,
      createdAt: m.createdAt,
    })),
  };
}