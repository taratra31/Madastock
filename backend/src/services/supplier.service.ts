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
      { name: { contains: q, mode: 'insensitive' } },
      { contactName: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
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

  return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
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
