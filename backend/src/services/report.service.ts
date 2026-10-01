import prisma from '../lib/prisma';
import { badRequest } from '../utils/httpError';

export interface ReportPeriod {
  from: Date;
  to: Date;
}

/** Options de restitution : sans `cost.view`, tous les montants de coût sont neutralisés. */
export interface ReportOptions {
  includeCosts: boolean;
}

export function parsePeriod(from?: string, to?: string): ReportPeriod {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw badRequest('Dates invalides');
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  if (start > end) throw badRequest('La date de début doit précéder la date de fin');
  return { from: start, to: end };
}

/** Nombre de jours calendaires couverts, bornes incluses (indépendant de l'heure). */
export function periodDayCount({ from, to }: ReportPeriod): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const mask = (value: number, includeCosts: boolean) => (includeCosts ? round2(value) : null);

/** Chiffre d'affaires, marge, produits vendus, charges sur la période. */
export async function salesReport(storeId: string, { from, to }: ReportPeriod, options: ReportOptions) {
  const includeCosts = options.includeCosts;
  const [sales, expenses, saleCount, previousSales] = await Promise.all([
    prisma.sale.findMany({
      where: { storeId, status: 'COMPLETED', createdAt: { gte: from, lte: to } },
      select: {
        id: true,
        subtotalAr: true,
        discountAr: true,
        taxAr: true,
        totalAr: true,
        createdAt: true,
        paymentMethod: true,
        items: {
          select: {
            quantityAr: true,
            unitPriceAr: true,
            costPriceAr: true,
            lineTotalAr: true,
            product: { select: { id: true, name: true, sku: true } },
          },
        },
      },
    }),
    prisma.expense.findMany({
      where: { storeId, incurredAt: { gte: from, lte: to } },
      select: { amountAr: true, category: true },
    }),
    prisma.sale.count({ where: { storeId, status: 'COMPLETED', createdAt: { gte: from, lte: to } } }),
    prisma.sale.aggregate({
      where: { storeId, status: 'COMPLETED', createdAt: { lte: from } },
      _sum: { totalAr: true },
    }),
  ]);

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalAr), 0);
  const previousRevenue = Number(previousSales._sum.totalAr ?? 0);
  const totalTax = sales.reduce((sum, s) => sum + Number(s.taxAr), 0);
  const totalDiscount = sales.reduce((sum, s) => sum + Number(s.discountAr), 0);
  const totalCost = sales.reduce(
    (sum, s) => sum + s.items.reduce((sub, i) => sub + Number(i.quantityAr) * Number(i.costPriceAr), 0),
    0,
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amountAr), 0);

  // Agrégation par produit
  const products = new Map<
    string,
    { productId: string; name: string; sku: string | null; qty: number; revenue: number; cost: number }
  >();
  for (const sale of sales) {
    for (const item of sale.items) {
      if (!item.product) continue;
      const entry = products.get(item.product.id) ?? {
        productId: item.product.id,
        name: item.product.name,
        sku: item.product.sku,
        qty: 0,
        revenue: 0,
        cost: 0,
      };
      entry.qty += Number(item.quantityAr);
      entry.revenue += Number(item.lineTotalAr);
      entry.cost += Number(item.quantityAr) * Number(item.costPriceAr);
      products.set(item.product.id, entry);
    }
  }

  const byPaymentMethod = new Map<string, number>();
  for (const sale of sales) {
    byPaymentMethod.set(sale.paymentMethod, (byPaymentMethod.get(sale.paymentMethod) ?? 0) + Number(sale.totalAr));
  }

  const byExpenseCategory = new Map<string, number>();
  for (const expense of expenses) {
    const key = expense.category || 'Autres';
    byExpenseCategory.set(key, (byExpenseCategory.get(key) ?? 0) + Number(expense.amountAr));
  }

  // Série journalière pour le graphique
  const daily = new Map<string, { revenue: number; count: number }>();
  for (const sale of sales) {
    const key = sale.createdAt.toISOString().slice(0, 10);
    const entry = daily.get(key) ?? { revenue: 0, count: 0 };
    entry.revenue += Number(sale.totalAr);
    entry.count += 1;
    daily.set(key, entry);
  }
  const days = Math.min(366, periodDayCount({ from, to }));
  const series = Array.from({ length: days }, (_, index) => {
    const date = new Date(from.getTime() + index * 86400000);
    const key = date.toISOString().slice(0, 10);
    const entry = daily.get(key);
    return { date: key, revenue: round2(entry?.revenue ?? 0), sales: entry?.count ?? 0 };
  });

  const topProducts = [...products.values()]
    .map((p) => ({
      ...p,
      qty: round2(p.qty),
      revenue: round2(p.revenue),
      cost: mask(p.cost, includeCosts),
      profit: mask(p.revenue - p.cost, includeCosts),
      marginPct: includeCosts && p.revenue > 0 ? round2(((p.revenue - p.cost) / p.revenue) * 100) : null,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const grossProfit = totalRevenue - totalTax - totalCost;

  return {
    period: { from, to },
    includesCosts: includeCosts,
    totals: {
      revenue: round2(totalRevenue),
      revenueExclTax: round2(totalRevenue - totalTax),
      salesCount: saleCount,
      averageBasket: saleCount > 0 ? round2(totalRevenue / saleCount) : 0,
      costOfGoods: mask(totalCost, includeCosts),
      grossProfit: mask(grossProfit, includeCosts),
      marginPct: includeCosts && totalRevenue > 0 ? round2((grossProfit / totalRevenue) * 100) : null,
      expenses: round2(totalExpenses),
      netProfit: mask(grossProfit - totalExpenses, includeCosts),
      discounts: round2(totalDiscount),
      tax: round2(totalTax),
      growthPct: previousRevenue > 0 ? round2(((totalRevenue - previousRevenue) / previousRevenue) * 100) : null,
    },
    topProducts: topProducts.slice(0, 20),
    slowMovers: [...topProducts].sort((a, b) => a.qty - b.qty).slice(0, 10),
    byPaymentMethod: [...byPaymentMethod.entries()].map(([method, amount]) => ({
      method,
      amount: round2(amount),
      pct: totalRevenue > 0 ? round2((amount / totalRevenue) * 100) : 0,
    })),
    byExpenseCategory: [...byExpenseCategory.entries()]
      .map(([category, amount]) => ({ category, amount: round2(amount) }))
      .sort((a, b) => b.amount - a.amount),
    series,
  };
}

/**
 * Rotation des stocks = coût de revient vendu / valeur du stock, ramené au mois.
 * Un stock dormant (aucune vente sur la période) ressort dans `deadStock`.
 */
export async function rotationReport(storeId: string, period: ReportPeriod, options: ReportOptions) {
  const includeCosts = options.includeCosts;
  const { from, to } = period;
  const periodDays = periodDayCount(period);

  const [sold, currentStock] = await Promise.all([
    prisma.saleItem.groupBy({
      by: ['productId'],
      where: { sale: { storeId, status: 'COMPLETED', createdAt: { gte: from, lte: to } } },
      _sum: { quantityAr: true, costPriceAr: true },
    }),
    prisma.stock.findMany({
      where: { storeId, warehouse: { isActive: true } },
      select: {
        productId: true,
        quantityAr: true,
        reservedQty: true,
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit: true,
            trackStock: true,
            costPriceAr: true,
            sellingPriceAr: true,
            lowStockThreshold: true,
          },
        },
      },
    }),
  ]);

  const soldByProduct = new Map<string, { qty: number; cost: number }>();
  for (const row of sold) {
    if (!row.productId) continue;
    const qty = Number(row._sum.quantityAr ?? 0);
    const cost = qty * Number(row._sum.costPriceAr ?? 0);
    soldByProduct.set(row.productId, { qty, cost });
  }

  const rows = currentStock
    .filter((s) => s.product?.trackStock)
    .map((s) => {
      const product = s.product!;
      const quantity = Number(s.quantityAr);
      const reserved = Number(s.reservedQty);
      const soldRow = soldByProduct.get(product.id);
      const qtySold = soldRow?.qty ?? 0;
      const soldCost = soldRow?.cost ?? 0;
      const stockValue = quantity * Number(product.costPriceAr);
      const dailySold = qtySold / periodDays;

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        quantity: round2(quantity),
        available: round2(quantity - reserved),
        stockValue: mask(stockValue, includeCosts),
        soldQty: round2(qtySold),
        revenue: round2(qtySold * Number(product.sellingPriceAr)),
        soldCost: mask(soldCost, includeCosts),
        turnoverRatio: includeCosts && stockValue > 0 ? round2(soldCost / stockValue) : null,
        daysOfStock: dailySold > 0 ? round2(quantity / dailySold) : null,
        isLow: quantity <= (product.lowStockThreshold ?? 5),
      };
    });

  const totalValue = rows.reduce((sum, r) => sum + Number(r.stockValue ?? 0), 0);
  const totalSoldCost = rows.reduce((sum, r) => sum + Number(r.soldCost ?? 0), 0);
  const totalSoldRevenue = rows.reduce((sum, r) => sum + r.revenue, 0);
  const deadStock = rows.filter((r) => r.soldQty === 0);
  const sortedByTurnover = [...rows].sort(
    (a, b) => (b.turnoverRatio ?? -1) - (a.turnoverRatio ?? -1),
  );

  return {
    period,
    includesCosts: includeCosts,
    totals: {
      stockValue: mask(totalValue, includeCosts),
      soldRevenue: round2(totalSoldRevenue),
      rotationRatio:
        includeCosts && totalValue > 0 ? round2((totalSoldCost / totalValue) * (30 / periodDays)) : null,
      productCount: rows.length,
      periodDays,
      deadStockCount: deadStock.length,
      deadStockValue: mask(deadStock.reduce((s, r) => s + Number(r.stockValue ?? 0), 0), includeCosts),
    },
    topRotation: sortedByTurnover.slice(0, 15),
    slowRotation: [...sortedByTurnover].reverse().slice(0, 15),
    deadStock: deadStock
      .filter((r) => Number(r.stockValue ?? 0) > 0 || !includeCosts)
      .sort((a, b) => Number(b.stockValue ?? 0) - Number(a.stockValue ?? 0))
      .slice(0, 20),
    lowStock: rows.filter((r) => r.isLow).sort((a, b) => a.quantity - b.quantity).slice(0, 20),
  };
}

/** Performance produit : chiffre d'affaires par unité de trésorerie immobilisée. */
export async function productPerformance(storeId: string, period: ReportPeriod, options: ReportOptions) {
  const report = await rotationReport(storeId, period, options);
  const bestMargins = report.topRotation
    .filter((r) => r.revenue > 0 && r.stockValue !== null)
    .map((r) => ({ ...r, capitalPct: round2((Number(r.stockValue) / r.revenue) * 100) }))
    .sort((a, b) => a.capitalPct - b.capitalPct)
    .slice(0, 15);
  const capitalList = bestMargins.map((r) => r.capitalPct);

  return {
    ...report,
    bestMargins,
    averageCapitalPct: capitalList.length
      ? round2(capitalList.reduce((s, c) => s + c, 0) / capitalList.length)
      : null,
  };
}
