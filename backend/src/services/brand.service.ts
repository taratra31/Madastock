import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import type { BrandInput } from '../validators/supply.validator';

export interface Brand {
  id: string;
  storeId: string;
  name: string;
  logoUrl: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export async function listBrands(
  storeId: string,
  query: { search?: string; activeOnly?: boolean; withCounts?: boolean } = {},
) {
  const where: Record<string, any> = { storeId };
  if (query.search) where.name = { contains: query.search.trim() };
  if (query.activeOnly) where.isActive = true;

  return prisma.brand.findMany({
    where,
    include: query.withCounts === false ? undefined : { _count: { select: { products: true } } },
    orderBy: { name: 'asc' },
  });
}

export async function getBrand(storeId: string, brandId: string) {
  const brand = await prisma.brand.findFirst({ where: { id: brandId, storeId } });
  if (!brand) throw notFound('Marque introuvable');
  return brand;
}

export async function createBrand(storeId: string, input: BrandInput) {
  const name = input.name.trim();
  const existing = await prisma.brand.findFirst({ where: { storeId, name } });
  if (existing) throw badRequest('Une marque porte déjà ce nom');
  return prisma.brand.create({
    data: {
      storeId,
      name,
      logoUrl: input.logoUrl?.trim() || null,
      description: input.description ?? null,
      isActive: input.isActive ?? true,
    },
  });
}

export async function updateBrand(storeId: string, brandId: string, input: Partial<BrandInput>) {
  const brand = await getBrand(storeId, brandId);
  if (input.name && input.name.trim() !== brand.name) {
    const dup = await prisma.brand.findFirst({
      where: { storeId, name: input.name.trim(), id: { not: brandId } },
    });
    if (dup) throw badRequest('Une marque porte déjà ce nom');
  }
  return prisma.brand.update({
    where: { id: brand.id },
    data: {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl.trim() || null } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
    },
  });
}

export async function deleteBrand(storeId: string, brandId: string) {
  const brand = await getBrand(storeId, brandId);
  const productCount = await prisma.product.count({ where: { brandId: brand.id } });
  if (productCount > 0) {
    throw badRequest(
      `Impossible : ${productCount} produit(s) utilisent cette marque. Retirez-la des produits ou désactivez-la.`,
    );
  }
  await prisma.brand.delete({ where: { id: brand.id } });
  return { success: true };
}

export async function getBrandStats(storeId: string) {
  const [total, active, products, groups] = await Promise.all([
    prisma.brand.count({ where: { storeId } }),
    prisma.brand.count({ where: { storeId, isActive: true } }),
    prisma.product.count({ where: { storeId, brandId: { not: null } } }),
    prisma.product.groupBy({
      by: ['brandId'],
      where: { storeId, brandId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { brandId: 'desc' } },
      take: 5,
    }),
  ]);

  const names = await prisma.brand.findMany({
    where: { storeId, id: { in: groups.map((g) => g.brandId).filter((v): v is string => !!v) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(names.map((n) => [n.id, n.name]));

  return {
    total,
    active,
    productsWithBrand: products,
    topBrands: groups
      .filter((g) => g.brandId)
      .map((g) => ({
        brandId: g.brandId as string,
        name: nameById.get(g.brandId as string) ?? 'Inconnu',
        products: g._count._all,
      })),
  };
}
