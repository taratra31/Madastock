import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

type DecimalLike = { toString(): string };

export interface SaleItemInput {
  productId?: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  discount?: number;
  tax?: number;
  costPrice?: number;
}

export interface CreateSaleInput {
  customerId?: string;
  subtotalAr?: number;
  discountAr?: number;
  taxAr?: number;
  totalAr: number;
  amountPaidAr?: number;
  paymentMethod?: string;
  isWholesale?: boolean;
  notes?: string;
  items: SaleItemInput[];
  warehouseId?: string;
}

const serialize = {
  num: (v: DecimalLike | null | undefined) => Number(v ?? 0),
  pick: (id: string | null | undefined) => (id ? { id } : null),
};

function serializeSale(sale: any) {
  return {
    id: sale.id,
    storeId: sale.storeId,
    receiptNumber: sale.receiptNumber,
    customerId: sale.customerId,
    customer: sale.customer
      ? { id: sale.customer.id, fullName: `${sale.customer.firstName} ${sale.customer.lastName}`.trim(), phone: sale.customer.phone }
      : null,
    status: sale.status,
    paymentStatus: sale.paymentStatus,
    paymentMethod: sale.paymentMethod,
    isWholesale: sale.isWholesale,
    subtotalAr: serialize.num(sale.subtotalAr),
    discountAr: serialize.num(sale.discountAr),
    taxAr: serialize.num(sale.taxAr),
    totalAr: serialize.num(sale.totalAr),
    amountPaidAr: serialize.num(sale.amountPaidAr),
    changeAr: serialize.num(sale.changeAr),
    notes: sale.notes,
    createdAt: sale.createdAt,
    createdBy: sale.createdBy
      ? { id: sale.createdBy.id, fullName: sale.createdBy.fullName }
      : null,
    items: (sale.items ?? []).map((it: any) => ({
      id: it.id,
      productId: it.productId,
      variantId: it.variantId,
      quantity: serialize.num(it.quantityAr),
      unitPrice: serialize.num(it.unitPriceAr),
      discount: serialize.num(it.discountAr),
      tax: serialize.num(it.taxAr),
      lineTotal: serialize.num(it.lineTotalAr),
      product: it.product
        ? { id: it.product.id, name: it.product.name, sku: it.product.sku }
        : null,
      variant: it.variant
        ? { id: it.variant.id, name: it.variant.name, sku: it.variant.sku }
        : null,
    })),
  };
}

async function pickSellWarehouse(storeId: string, warehouseId?: string) {
  if (warehouseId) {
    const wh = await prisma.warehouse.findFirst({
      where: { id: warehouseId, storeId, isActive: true },
    });
    if (wh) return wh;
  }
  const main = await prisma.warehouse.findFirst({
    where: { storeId, isMain: true, isActive: true },
  });
  if (main) return main;
  const any = await prisma.warehouse.findFirst({
    where: { storeId, isActive: true },
  });
  if (any) return any;
  throw badRequest('Aucun entrepôt actif pour effectuer la vente');
}

async function nextReceiptNumber(storeId: string, tx?: any) {
  const client = tx ?? prisma;
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const store = await client.store.findUnique({ where: { id: storeId }, select: { id: true } });
  const suffix = store ? store.id.replace(/-/g, '').slice(-4).toUpperCase() : 'MADA';
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const count = await client.sale.count({
    where: { storeId, createdAt: { gte: start } },
  });
  return `V-${suffix}-${ymd}-${String(count + 1).padStart(4, '0')}`;
}

type Tx = {
  sale: any;
  saleItem: any;
  stock: any;
  stockMovement: any;
  product: any;
};

export async function createSale(storeId: string, userId: string, input: CreateSaleInput) {
  if (!input.items || input.items.length === 0) {
    throw badRequest('Une vente doit contenir au moins un article');
  }

  const warehouse = await pickSellWarehouse(storeId, input.warehouseId);

  const subtotal = Number(input.subtotalAr ?? input.items.reduce((s, it) => s + Number(it.unitPrice) * Number(it.quantity), 0));
  const discount = Number(input.discountAr ?? 0);
  const tax = Number(input.taxAr ?? 0);
  const total = Number(input.totalAr ?? subtotal - discount + tax);
  const amountPaid = Number(input.amountPaidAr ?? total);
  const change = Math.max(0, amountPaid - total);
  const paymentStatus = amountPaid >= total ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'PENDING';
  const receiptNumber = await nextReceiptNumber(storeId);

  const sale = await prisma.$transaction(async (tx: Tx) => {
    const created = await tx.sale.create({
      data: {
        storeId,
        receiptNumber,
        customerId: input.customerId || null,
        createdById: userId,
        status: 'COMPLETED',
        paymentStatus,
        subtotalAr: subtotal,
        discountAr: discount,
        taxAr: tax,
        totalAr: total,
        amountPaidAr: amountPaid,
        changeAr: change,
        paymentMethod: (input.paymentMethod ?? 'CASH') as any,
        isWholesale: input.isWholesale ?? false,
        notes: input.notes || null,
      },
    });

    for (const it of input.items) {
      if (!it.productId) continue;

      const [stocks, product] = await Promise.all([
        tx.stock.findMany({
          where: {
            storeId,
            warehouseId: warehouse.id,
            productId: it.productId,
            variantId: it.variantId || null,
          },
          orderBy: [{ expiryDate: { sort: 'asc', nulls: 'last' } }],
          take: 1,
        }),
        tx.product.findUnique({
          where: { id: it.productId },
          select: { costPriceAr: true },
        }),
      ]);
      const stock = stocks[0];
      if (!stock) throw badRequest('Stock introuvable pour un des articles');
      if (stock.expiryDate && stock.expiryDate < new Date()) {
        throw badRequest('Produit périmé : impossible de le vendre');
      }
      if (Number(stock.quantityAr) < Number(it.quantity)) {
        throw badRequest('Stock insuffisant pour un des articles');
      }

      const costPriceAr = it.costPrice ?? Number(product?.costPriceAr ?? 0);

      await tx.saleItem.create({
        data: {
          saleId: created.id,
          productId: it.productId,
          variantId: it.variantId || null,
          quantityAr: it.quantity,
          unitPriceAr: it.unitPrice,
          costPriceAr,
          discountAr: it.discount ?? 0,
          taxAr: it.tax ?? 0,
          lineTotalAr: Number(it.unitPrice) * Number(it.quantity) - Number(it.discount ?? 0) + Number(it.tax ?? 0),
        },
      });

      await tx.stock.update({
        where: { id: stock.id },
        data: { quantityAr: { decrement: Number(it.quantity) } },
      });

      await tx.stockMovement.create({
        data: {
          storeId,
          warehouseId: warehouse.id,
          productId: it.productId,
          variantId: it.variantId || null,
          movementType: 'SALE',
          quantity: Number(it.quantity),
          reason: 'Vente',
          createdById: userId,
        },
      });
    }

    return created;
  });

  return getSale(storeId, sale.id);
}

export async function listSales(
  storeId: string,
  query: { search?: string; status?: string; from?: string; to?: string; page?: number; limit?: number }
) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const where: Record<string, any> = { storeId };

  if (query.status) where.status = query.status;
  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { receiptNumber: { contains: q } },
      { customer: { fullName: { contains: q } } },
    ];
  }
  if (query.from || query.to) {
    where.createdAt = {};
    if (query.from) where.createdAt.gte = new Date(query.from);
    if (query.to) where.createdAt.lte = new Date(query.to);
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
        createdBy: { select: { id: true, fullName: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            variant: { select: { id: true, name: true, sku: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    data: sales.map(serializeSale),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getSale(storeId: string, saleId: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, storeId },
    include: {
        customer: { select: { id: true, firstName: true, lastName: true, phone: true } },
      createdBy: { select: { id: true, fullName: true } },
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
          variant: { select: { id: true, name: true, sku: true } },
        },
      },
    },
  });
  if (!sale) throw notFound('Vente introuvable');
  return serializeSale(sale);
}

export async function cancelSale(storeId: string, saleId: string, reason?: string) {
  const sale = await prisma.sale.findFirst({
    where: { id: saleId, storeId },
    include: { items: true },
  });
  if (!sale) throw notFound('Vente introuvable');
  if (sale.status === 'CANCELLED') throw badRequest('Vente déjà annulée');

  await prisma.$transaction(async (tx: Tx) => {
    await tx.sale.update({
      where: { id: saleId },
      data: {
        status: 'CANCELLED',
        cancelReason: reason ?? 'Annulée',
        cancelledAt: new Date(),
      },
    });

    for (const it of sale.items) {
      if (!it.productId) continue;
      await tx.stock.updateMany({
        where: {
          storeId,
          productId: it.productId,
          variantId: it.variantId || null,
        },
        data: { quantityAr: { increment: Number(it.quantityAr) } },
      });
    }
  });

  return getSale(storeId, saleId);
}
