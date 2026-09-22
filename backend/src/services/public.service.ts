import prisma from '../lib/prisma';
import { notFound } from '../utils/httpError';

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