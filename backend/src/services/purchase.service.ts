import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import type { PurchaseInput } from '../validators/supply.validator';
import { recordCashMovement } from './cash.service';

export interface PurchaseQuery {
  search?: string;
  status?: string;
  supplierId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

const PURCHASE_INCLUDE = {
  supplier: { select: { id: true, name: true, phone: true, email: true } },
  warehouse: { select: { id: true, name: true, isMain: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true, unit: true, imageUrl: true } },
      variant: { select: { id: true, name: true, sku: true } },
    },
  },
};

function serializePurchase<T extends Record<string, any>>(purchase: T) {
  const p = purchase as any;
  const items = (p.items ?? []).map((it: any) => ({
    id: it.id,
    productId: it.productId,
    productName: it.product?.name ?? null,
    productSku: it.product?.sku ?? null,
    productUnit: it.product?.unit ?? null,
    imageUrl: it.product?.imageUrl ?? null,
    variantId: it.variantId,
    variantName: it.variant?.name ?? null,
    quantity: Number(it.quantityAr),
    receivedQuantity: Number(it.receivedQtyAr),
    unitCostAr: Number(it.unitCostAr),
    discountAr: Number(it.discountAr),
    taxAr: Number(it.taxAr),
    lineTotalAr: Number(it.lineTotalAr),
  }));

  return {
    id: p.id,
    referenceNo: p.referenceNo,
    status: p.status,
    supplierId: p.supplierId,
    supplierName: p.supplier?.name ?? null,
    supplierPhone: p.supplier?.phone ?? null,
    warehouseId: p.warehouseId,
    warehouseName: p.warehouse?.name ?? null,
    subtotalAr: Number(p.subtotalAr),
    discountAr: Number(p.discountAr),
    taxAr: Number(p.taxAr),
    shippingAr: Number(p.shippingAr),
    totalAr: Number(p.totalAr),
    amountPaidAr: Number(p.amountPaidAr),
    dueAr: Math.max(0, Number(p.totalAr) - Number(p.amountPaidAr)),
    expectedAt: p.expectedAt,
    receivedAt: p.receivedAt,
    notes: p.notes,
    itemsCount: items.length,
    totalQuantity: items.reduce((s: number, i: any) => s + i.quantity, 0),
    items,
    createdAt: p.createdAt,
  };
}

async function nextReference(storeId: string, tx?: any) {
  const client = tx ?? prisma;
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const store = await client.store.findUnique({ where: { id: storeId }, select: { id: true } });
  const suffix = store ? store.id.replace(/-/g, '').slice(-4).toUpperCase() : 'MADA';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const count = await client.purchase.count({ where: { storeId, createdAt: { gte: start } } });
  return `ACH-${suffix}-${ymd}-${String(count + 1).padStart(4, '0')}`;
}

export async function listPurchases(storeId: string, query: PurchaseQuery) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const where: Record<string, any> = { storeId };

  if (query.status) where.status = query.status;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { referenceNo: { contains: q } },
      { supplier: { name: { contains: q } } },
      { notes: { contains: q } },
    ];
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  const [purchases, total] = await Promise.all([
    prisma.purchase.findMany({
      where,
      include: PURCHASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.purchase.count({ where }),
  ]);

  return {
    data: purchases.map(serializePurchase),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getPurchase(storeId: string, purchaseId: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, storeId },
    include: PURCHASE_INCLUDE,
  });
  if (!purchase) throw notFound('Achat introuvable');
  return serializePurchase(purchase);
}

export async function getPurchaseStats(storeId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [rows, monthAgg, pending, topSuppliers] = await Promise.all([
    prisma.purchase.findMany({
      where: { storeId, status: { not: 'CANCELLED' } },
      select: { totalAr: true, amountPaidAr: true },
    }),
    prisma.purchase.aggregate({
      where: { storeId, status: { not: 'CANCELLED' }, createdAt: { gte: startOfMonth } },
      _sum: { totalAr: true },
      _count: true,
    }),
    prisma.purchase.count({ where: { storeId, status: 'ORDERED' } }),
    prisma.purchase.groupBy({
      by: ['supplierId'],
      where: { storeId, status: { not: 'CANCELLED' }, supplierId: { not: null } },
      _sum: { totalAr: true },
      orderBy: { _sum: { totalAr: 'desc' } },
      take: 5,
    }),
  ]);

  const names = await prisma.supplier.findMany({
    where: { storeId, id: { in: topSuppliers.map((t) => t.supplierId).filter((v): v is string => !!v) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(names.map((n) => [n.id, n.name]));

  return {
    purchasesCount: rows.length,
    totalPurchasesAr: rows.reduce((s, p) => s + Number(p.totalAr), 0),
    outstandingAr: rows.reduce((s, p) => s + Math.max(0, Number(p.totalAr) - Number(p.amountPaidAr)), 0),
    monthPurchasesAr: Number(monthAgg._sum.totalAr ?? 0),
    monthPurchasesCount: monthAgg._count,
    pendingCount: pending,
    topSuppliers: topSuppliers
      .filter((t) => t.supplierId)
      .map((t) => ({
        supplierId: t.supplierId as string,
        name: nameById.get(t.supplierId as string) ?? 'Inconnu',
        totalAr: Number(t._sum.totalAr ?? 0),
      })),
  };
}

type Tx = {
  purchase: any;
  purchaseItem: any;
  product: any;
  stock: any;
  stockMovement: any;
};

/** Augmente le stock d'un produit (utilisé à la réception d'un achat). */
async function receiveStockInTx(
  tx: Tx,
  args: {
    storeId: string;
    warehouseId: string;
    productId: string;
    variantId: string | null;
    quantity: number;
    unitCostAr: number;
    userId: string;
    reason: string;
  },
) {
  const existing = await tx.stock.findFirst({
    where: {
      warehouseId: args.warehouseId,
      productId: args.productId,
      variantId: args.variantId,
    },
  });

  if (existing) {
    await tx.stock.update({
      where: { id: existing.id },
      data: { quantityAr: { increment: args.quantity } },
    });
  } else {
    await tx.stock.create({
      data: {
        storeId: args.storeId,
        warehouseId: args.warehouseId,
        productId: args.productId,
        variantId: args.variantId,
        quantityAr: args.quantity,
        reservedQty: 0,
      },
    });
  }

  await tx.stockMovement.create({
    data: {
      storeId: args.storeId,
      warehouseId: args.warehouseId,
      productId: args.productId,
      variantId: args.variantId,
      movementType: 'PURCHASE',
      quantity: args.quantity,
      unitCostAr: args.unitCostAr,
      reason: args.reason,
      createdById: args.userId,
    },
  });
}

export async function createPurchase(storeId: string, userId: string, input: PurchaseInput) {
  if (!input.items || input.items.length === 0) {
    throw badRequest('Un achat doit contenir au moins un article');
  }

  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, storeId, isActive: true },
  });
  if (!warehouse) throw notFound('Entrepôt introuvable');

  if (input.supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: input.supplierId, storeId },
    });
    if (!supplier) throw notFound('Fournisseur introuvable');
  }

  const productIds = [...new Set(input.items.map((i) => i.productId))];
  const products = await prisma.product.findMany({
    where: { storeId, id: { in: productIds } },
    select: { id: true, name: true },
  });
  if (products.length !== productIds.length) {
    throw badRequest("Un des produits n'existe pas dans cette boutique");
  }

  const items = input.items.map((it) => {
    const quantity = Number(it.quantity);
    const unitCost = Number(it.unitCostAr);
    const discount = Number(it.discountAr ?? 0);
    const tax = Number(it.taxAr ?? 0);
    return {
      productId: it.productId,
      variantId: it.variantId || null,
      quantity,
      unitCostAr: unitCost,
      discountAr: discount,
      taxAr: tax,
      lineTotalAr: Math.max(0, quantity * unitCost - discount + tax),
    };
  });

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitCostAr, 0);
  const globalDiscount = Number(input.discountAr ?? 0);
  const tax = Number(input.taxAr ?? 0);
  const shipping = Number(input.shippingAr ?? 0);
  const total = Math.max(0, subtotal - globalDiscount + tax + shipping);
  const amountPaid = Math.min(Number(input.amountPaidAr ?? 0), total);
  const isReceived = input.status === 'RECEIVED';

  const created = await prisma.$transaction(async (tx: Tx) => {
    const referenceNo = await nextReference(storeId, tx);
    const purchase = await tx.purchase.create({
      data: {
        storeId,
        supplierId: input.supplierId || null,
        warehouseId: warehouse.id,
        referenceNo,
        status: isReceived ? 'RECEIVED' : 'ORDERED',
        subtotalAr: subtotal,
        discountAr: globalDiscount,
        taxAr: tax,
        shippingAr: shipping,
        totalAr: total,
        amountPaidAr: amountPaid,
        expectedAt: input.expectedAt ? new Date(input.expectedAt) : null,
        receivedAt: isReceived ? new Date() : null,
        notes: input.notes || null,
        createdById: userId,
        items: { create: items.map((i) => ({ ...i, receivedQtyAr: isReceived ? i.quantity : 0 })) },
      },
    });

    if (isReceived) {
      for (const it of items) {
        await receiveStockInTx(tx, {
          storeId,
          warehouseId: warehouse.id,
          productId: it.productId,
          variantId: it.variantId,
          quantity: it.quantity,
          unitCostAr: it.unitCostAr,
          userId,
          reason: `Achat ${referenceNo}`,
        });
        if (input.updateCostPrice !== false) {
          await tx.product.update({
            where: { id: it.productId },
            data: { costPriceAr: it.unitCostAr },
          });
        }
      }
    }

    return purchase;
  });

  // Sortie de caisse si l'achat est réglé en espèces.
  if (amountPaid > 0) {
    await recordCashMovement({
      storeId,
      userId,
      transactionType: 'PURCHASE',
      amountAr: amountPaid,
      method: 'CASH',
      source: 'PURCHASE',
      purchaseId: created.id,
      description: `Achat ${created.referenceNo}`,
    });
  }

  return getPurchase(storeId, created.id);
}

export async function setPurchaseStatus(
  storeId: string,
  userId: string,
  purchaseId: string,
  status: 'ORDERED' | 'RECEIVED' | 'CANCELLED',
) {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, storeId },
    include: { items: { include: { product: { select: { id: true, name: true } } } } },
  });
  if (!purchase) throw notFound('Achat introuvable');
  if (purchase.status === status) throw badRequest('L\'achat est déjà dans cet état');
  if (purchase.status === 'CANCELLED') throw badRequest('Achat annulé : aucune modification possible');

  if (status === 'RECEIVED') {
    await prisma.$transaction(async (tx: Tx) => {
      for (const it of purchase.items) {
        const missing = Number(it.quantityAr) - Number(it.receivedQtyAr);
        if (missing > 0) {
          await tx.purchaseItem.update({
            where: { id: it.id },
            data: { receivedQtyAr: Number(it.quantityAr) },
          });
          if (it.productId) {
            await receiveStockInTx(tx, {
              storeId,
              warehouseId: purchase.warehouseId,
              productId: it.productId,
              variantId: it.variantId,
              quantity: missing,
              unitCostAr: Number(it.unitCostAr),
              userId,
              reason: `Réception achat ${purchase.referenceNo}`,
            });
          }
        }
      }
      await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: 'RECEIVED', receivedAt: new Date() },
      });
    });
  } else {
    await prisma.purchase.update({ where: { id: purchase.id }, data: { status } });
  }

  return getPurchase(storeId, purchase.id);
}

export async function deletePurchase(storeId: string, purchaseId: string) {
  const purchase = await prisma.purchase.findFirst({
    where: { id: purchaseId, storeId },
    include: { items: true },
  });
  if (!purchase) throw notFound('Achat introuvable');

  const received = purchase.items.some((i) => Number(i.receivedQtyAr) > 0);
  if (received || purchase.status === 'RECEIVED') {
    throw badRequest(
      'Impossible de supprimer un achat réceptionné (le stock a été mouvementé). Annulez-le à la place.',
    );
  }
  if (purchase.status === 'CANCELLED') {
    throw badRequest('Achat déjà annulé');
  }

  await prisma.cashTransaction.deleteMany({ where: { storeId, purchaseId: purchase.id } });
  await prisma.purchase.delete({ where: { id: purchase.id } });
  return { success: true };
}
