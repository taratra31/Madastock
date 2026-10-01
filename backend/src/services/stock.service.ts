import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import * as warehouseService from './warehouse.service';

/** Journal des mouvements de stock : filtres + pagination. */
export async function listMovements(storeId: string, query: {
  productId?: string;
  warehouseId?: string;
  movementType?: string;
  referenceType?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: string;
  pageSize?: string;
}) {
  const page = Math.max(1, Number(query.page ?? '1') || 1);
  const pageSize = Math.min(200, Math.max(5, Number(query.pageSize ?? '25') || 25));

  const where: Record<string, unknown> = { storeId };

  if (query.productId) where.productId = query.productId;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.movementType) where.movementType = query.movementType;
  if (query.referenceType) where.referenceType = query.referenceType;
  if (query.search) {
    where.product = { name: { contains: query.search } };
  }
  if (query.from || query.to) {
    const createdAt: Record<string, Date> = {};
    if (query.from) createdAt.gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    where.createdAt = createdAt;
  }

  const [rows, total] = await Promise.all([
    prisma.stockMovement.findMany({
      where,
      include: {
        warehouse: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, sku: true, unit: true } },
        variant: { select: { id: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.stockMovement.count({ where }),
  ]);

  return {
    items: rows.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product?.name ?? '—',
      productSku: m.product?.sku ?? null,
      unit: m.product?.unit ?? 'pcs',
      variantName: m.variant?.name ?? null,
      warehouseId: m.warehouseId,
      warehouseName: m.warehouse?.name ?? '—',
      movementType: m.movementType,
      quantity: Number(m.quantity),
      unitCostAr: m.unitCostAr === null ? null : Number(m.unitCostAr),
      reason: m.reason,
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      createdByName: m.createdBy?.fullName || 'Système',
      createdAt: m.createdAt,
    })),
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listStock(storeId: string, query: {
  search?: string;
  lowStock?: boolean;
  warehouseId?: string;
  expiry?: string;
}) {
  const where: Record<string, unknown> = { storeId };

  const [stocks, totals] = await Promise.all([
    prisma.stock.findMany({
      where: query.warehouseId ? { ...where, warehouseId: query.warehouseId } : where,
      include: {
        warehouse: { select: { id: true, name: true, isMain: true } },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            imageUrl: true,
            lowStockThreshold: true,
            sellingPriceAr: true,
            costPriceAr: true,
            trackStock: true,
          },
        },
        variant: { select: { id: true, name: true } },
      },
      orderBy: [{ product: { name: 'asc' } }, { variant: { name: 'asc' } }],
    }),
    prisma.stock.aggregate({
      where: query.warehouseId ? { ...where, warehouseId: query.warehouseId } : where,
      _sum: { quantityAr: true, reservedQty: true },
    }),
  ]);

  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const rows = stocks
    .filter(s => s.product)
    .filter(s => {
      if (!query.search) return true;
      const q = query.search.toLowerCase();
      return (
        s.product?.name.toLowerCase().includes(q) ||
        s.variant?.name.toLowerCase().includes(q) ||
        (s.location ?? '').toLowerCase().includes(q)
      );
    })
    .filter(s => {
      if (!query.lowStock) return true;
      return (
        s.product?.trackStock === true &&
        Number(s.quantityAr) <= (s.product.lowStockThreshold ?? 5)
      );
    })
    .filter(s => {
      if (query.expiry === 'expired') return !!s.expiryDate && s.expiryDate < now;
      if (query.expiry === 'soon') return !!s.expiryDate && s.expiryDate >= now && s.expiryDate <= soon;
      return true;
    })
    .map(s => ({
      id: s.id,
      productId: s.productId,
      productName: s.product?.name,
      productSlug: s.product?.slug,
      imageUrl: s.product?.imageUrl,
      variantId: s.variantId,
      variantName: s.variant?.name ?? null,
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      isMainWarehouse: s.warehouse.isMain,
      quantity: Number(s.quantityAr),
      reserved: Number(s.reservedQty),
      available: Number(s.quantityAr) - Number(s.reservedQty),
      minStock: Number(s.minStock),
      location: s.location,
      batchNumber: s.batchNumber,
      expiryDate: s.expiryDate,
      isExpired: !!s.expiryDate && s.expiryDate < now,
      isExpiringSoon: !!s.expiryDate && s.expiryDate >= now && s.expiryDate <= soon,
      isLow:
        s.product?.trackStock === true &&
        Number(s.quantityAr) <= (s.product.lowStockThreshold ?? 5),
    }));

  const totalValue = rows.reduce(
    (sum, r) => sum + r.available * Number((stocks.find(s => s.id === r.id)?.product?.costPriceAr) ?? 0),
    0
  );

  return {
    data: rows,
    totals: {
      totalUnits: Number(totals._sum.quantityAr ?? 0),
      totalReserved: Number(totals._sum.reservedQty ?? 0),
      totalStockValueAr: totalValue,
    },
  };
}

export async function adjustStock(storeId: string, input: {
  productId: string;
  warehouseId: string;
  quantity: number;
  reason?: string;
  type?: 'IN' | 'OUT';
  unitCostAr?: number;
  batchNumber?: string;
  expiryDate?: string;
}) {
  if (!input.productId || !input.warehouseId) {
    throw badRequest('productId et warehouseId requis');
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, storeId, isActive: true },
  });
  if (!warehouse) throw notFound('Entrepôt introuvable');

  const qty = input.type === 'OUT' ? -Math.abs(input.quantity) : Math.abs(input.quantity);
  const stock = await prisma.stock.findFirst({
    where: {
      warehouseId: input.warehouseId,
      productId: input.productId,
      variantId: null,
    },
  });

  const meta = {
    batchNumber: input.batchNumber?.trim() || null,
    expiryDate: input.expiryDate ? new Date(input.expiryDate) : undefined,
  };

  if (!stock) {
    await prisma.stock.create({
      data: {
        storeId,
        warehouseId: input.warehouseId,
        productId: input.productId,
        quantityAr: Math.max(0, qty),
        reservedQty: 0,
        batchNumber: meta.batchNumber,
        expiryDate: meta.expiryDate,
      },
    });
  } else {
    const newQty = Number(stock.quantityAr) + qty;
    if (newQty < 0) throw badRequest('Stock insuffisant');
    await prisma.stock.update({
      where: { id: stock.id },
      data: {
        quantityAr: newQty,
        ...(input.batchNumber?.trim() ? { batchNumber: meta.batchNumber } : {}),
        ...(input.expiryDate ? { expiryDate: meta.expiryDate } : {}),
      },
    });
  }

  await prisma.stockMovement.create({
    data: {
      storeId,
      warehouseId: input.warehouseId,
      productId: input.productId,
      movementType: input.type === 'OUT' ? 'STOCK_OUT' : 'STOCK_IN',
      quantity: Math.abs(qty),
      unitCostAr: input.unitCostAr,
      reason: input.reason,
    },
  });

  return prisma.stock.findFirst({
    where: {
      warehouseId: input.warehouseId,
      productId: input.productId,
      variantId: null,
    },
  });
}

/** Dépôts : la source de vérité est le service warehouse (listes enrichies). */
export async function listWarehouses(storeId: string) {
  return warehouseService.listWarehouses(storeId);
}