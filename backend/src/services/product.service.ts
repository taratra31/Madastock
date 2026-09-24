import prisma from '../lib/prisma';
import { notFound, conflict } from '../utils/httpError';

export async function listProducts(storeId: string, query: {
  search?: string;
  categoryId?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, query.page ?? 1);
  const limit = Math.min(100, Math.max(1, query.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { storeId, isActive: true, deletedAt: null };
  if (query.search) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { sku: { contains: query.search, mode: 'insensitive' } },
      { barcode: { contains: query.search, mode: 'insensitive' } },
    ];
  }
  if (query.categoryId) {
    where.categoryId = query.categoryId;
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        stocks: {
          where: { warehouse: { isActive: true } },
          select: { quantityAr: true, reservedQty: true },
        },
        _count: { select: { variants: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return {
    data: products.map(({ stocks, ...p }) => ({
      ...p,
      totalStock: stocks.reduce((s, st) => s + Number(st.quantityAr) - Number(st.reservedQty), 0),
      costPriceAr: Number(p.costPriceAr),
      sellingPriceAr: Number(p.sellingPriceAr),
      wholesalePriceAr: p.wholesalePriceAr ? Number(p.wholesalePriceAr) : null,
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getProduct(storeId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId, deletedAt: null },
    include: {
      category: { select: { id: true, name: true } },
      brand: { select: { id: true, name: true } },
      stocks: {
        where: { warehouse: { isActive: true } },
        include: { warehouse: { select: { id: true, name: true, isMain: true } } },
      },
      variants: {
        where: { isActive: true },
        include: {
          stocks: {
            where: { warehouse: { isActive: true } },
            select: { quantityAr: true },
          },
        },
      },
    },
  });

  if (!product) {
    throw notFound('Produit introuvable');
  }

  const { stocks, ...rest } = product;
  return {
    ...rest,
    costPriceAr: Number(rest.costPriceAr),
    sellingPriceAr: Number(rest.sellingPriceAr),
    wholesalePriceAr: rest.wholesalePriceAr ? Number(rest.wholesalePriceAr) : null,
    stocks: stocks.map(s => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      isMain: s.warehouse.isMain,
      quantity: Number(s.quantityAr),
      reserved: Number(s.reservedQty),
    })),
    totalStock: stocks.reduce((s, st) => s + Number(st.quantityAr) - Number(st.reservedQty), 0),
    variants: rest.variants.map(v => ({
      ...v,
      totalStock: v.stocks.reduce((s, st) => s + Number(st.quantityAr), 0),
    })),
  };
}

export async function createProduct(storeId: string, input: {
  name: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  sku?: string;
  imageUrl?: string;
  unit?: string;
  costPriceAr: number;
  sellingPriceAr: number;
  wholesalePriceAr?: number;
  taxRatePct?: number;
  trackStock?: boolean;
}) {
  const slug = input.name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const existing = await prisma.product.findUnique({
    where: { storeId_slug: { storeId, slug } },
  });
  if (existing) {
    throw conflict('Un produit avec ce nom existe déjà');
  }

  return prisma.product.create({
    data: {
      storeId,
      name: input.name,
      slug,
      description: input.description,
      categoryId: input.categoryId,
      brandId: input.brandId,
      sku: input.sku,
      imageUrl: input.imageUrl,
      unit: input.unit,
      costPriceAr: input.costPriceAr,
      sellingPriceAr: input.sellingPriceAr,
      wholesalePriceAr: input.wholesalePriceAr,
      taxRatePct: input.taxRatePct,
      trackStock: input.trackStock ?? true,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
  });
}

export async function updateProduct(storeId: string, productId: string, input: Record<string, unknown>) {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId, deletedAt: null },
  });
  if (!product) {
    throw notFound('Produit introuvable');
  }

  return prisma.product.update({
    where: { id: productId },
    data: input,
    include: { category: { select: { id: true, name: true } } },
  });
}

export async function deleteProduct(storeId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId, deletedAt: null },
  });
  if (!product) {
    throw notFound('Produit introuvable');
  }

  await prisma.product.update({
    where: { id: productId },
    data: { isActive: false, deletedAt: new Date() },
  });
}
