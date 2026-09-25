import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';

export interface SupplierInput {
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  tinNumber?: string;
  notes?: string;
  isActive?: boolean;
}

export async function listSuppliers(
  storeId: string,
  query: { search?: string; page?: number; limit?: number; activeOnly?: boolean }
) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const where: any = { storeId };
  if (query.search) {
    const q = query.search.trim();
    where.OR = [
      { name: { contains: q } },
      { contactName: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  if (query.activeOnly) where.isActive = true;

  const [data, total] = await Promise.all([
    prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.supplier.count({ where }),
  ]);

  // Chiffres d'achats par fournisseur (agrégés séparément pour éviter
  // d'inclure toutes les lignes d'achat dans la liste).
  const ids = data.map((s) => s.id);
  const aggregates = ids.length
    ? await prisma.purchase.groupBy({
        by: ['supplierId'],
        where: { storeId, supplierId: { in: ids }, status: { not: 'CANCELLED' } },
        _sum: { totalAr: true, amountPaidAr: true },
        _count: { _all: true },
        _max: { createdAt: true },
      })
    : [];
  const bySupplier = new Map(aggregates.map((a) => [a.supplierId as string, a]));

  return {
    data: data.map((s) => {
      const agg = bySupplier.get(s.id);
      const totalAr = Number(agg?._sum.totalAr ?? 0);
      const paidAr = Number(agg?._sum.amountPaidAr ?? 0);
      return {
        ...s,
        purchasesCount: agg?._count._all ?? 0,
        purchasesTotalAr: totalAr,
        outstandingAr: Math.max(0, totalAr - paidAr),
        lastPurchaseAt: agg?._max.createdAt ?? null,
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getSupplier(storeId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId } });
  if (!supplier) throw notFound('Fournisseur introuvable');
  return supplier;
}

export async function createSupplier(storeId: string, input: SupplierInput) {
  if (!input.name?.trim()) throw badRequest('Le nom est obligatoire');
  const existing = await prisma.supplier.findFirst({
    where: { storeId, name: input.name.trim() },
  });
  if (existing) throw badRequest('Un fournisseur porte déjà ce nom');
  return prisma.supplier.create({
    data: { storeId, ...input, name: input.name.trim() },
  });
}

export async function updateSupplier(storeId: string, supplierId: string, input: Partial<SupplierInput>) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId } });
  if (!supplier) throw notFound('Fournisseur introuvable');
  if (input.name) {
    const dup = await prisma.supplier.findFirst({
      where: { storeId, name: input.name.trim(), id: { not: supplierId } },
    });
    if (dup) throw badRequest('Un fournisseur porte déjà ce nom');
  }
  return prisma.supplier.update({
    where: { id: supplierId },
    data: { ...input, name: input.name?.trim() },
  });
}

export async function deleteSupplier(storeId: string, supplierId: string) {
  const supplier = await prisma.supplier.findFirst({ where: { id: supplierId, storeId } });
  if (!supplier) throw notFound('Fournisseur introuvable');
  const purchaseCount = await prisma.purchase.count({ where: { supplierId } });
  if (purchaseCount > 0) {
    throw badRequest('Impossible : ce fournisseur a des achats. Désactivez-le à la place.');
  }
  await prisma.supplier.delete({ where: { id: supplierId } });
  return { success: true };
}

/**
 * Chiffres clés pour la page Fournisseurs : nombre de fournisseurs, volume
 * d'achats, ce qui reste dû et le top fournisseurs.
 */
export async function getSupplierStats(storeId: string) {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [total, active, purchases, monthAgg, top] = await Promise.all([
    prisma.supplier.count({ where: { storeId } }),
    prisma.supplier.count({ where: { storeId, isActive: true } }),
    prisma.purchase.findMany({
      where: { storeId, status: { not: 'CANCELLED' } },
      select: { totalAr: true, amountPaidAr: true },
    }),
    prisma.purchase.aggregate({
      where: { storeId, status: { not: 'CANCELLED' }, createdAt: { gte: startOfMonth } },
      _sum: { totalAr: true },
      _count: true,
    }),
    prisma.purchase.groupBy({
      by: ['supplierId'],
      where: { storeId, status: { not: 'CANCELLED' }, supplierId: { not: null } },
      _sum: { totalAr: true },
      orderBy: { _sum: { totalAr: 'desc' } },
      take: 5,
    }),
  ]);

  const names = await prisma.supplier.findMany({
    where: { storeId, id: { in: top.map((t) => t.supplierId).filter((v): v is string => !!v) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(names.map((n) => [n.id, n.name]));

  return {
    total,
    active,
    purchasesCount: purchases.length,
    totalPurchasesAr: purchases.reduce((s, p) => s + Number(p.totalAr), 0),
    outstandingAr: purchases.reduce(
      (s, p) => s + Math.max(0, Number(p.totalAr) - Number(p.amountPaidAr)),
      0,
    ),
    monthPurchasesAr: Number(monthAgg._sum.totalAr ?? 0),
    monthPurchasesCount: monthAgg._count,
    topSuppliers: top
      .filter((t) => t.supplierId)
      .map((t) => ({
        supplierId: t.supplierId as string,
        name: nameById.get(t.supplierId as string) ?? 'Inconnu',
        totalAr: Number(t._sum.totalAr ?? 0),
      })),
  };
}
