import prisma from '../lib/prisma';
import { conflict, notFound } from '../utils/httpError';

export async function listCategories(storeId: string, activeOnly = false) {
  return prisma.category.findMany({
    where: { storeId, ...(activeOnly ? { isActive: true } : {}) },
    include: { _count: { select: { products: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function createCategory(storeId: string, input: {
  name: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
}) {
  const existing = await prisma.category.findUnique({
    where: { storeId_name: { storeId, name: input.name } },
  });
  if (existing) throw conflict('Cette catégorie existe déjà');

  return prisma.category.create({
    data: {
      storeId,
      name: input.name,
      description: input.description,
      parentId: input.parentId,
      sortOrder: input.sortOrder ?? 0,
    },
  });
}

export async function updateCategory(storeId: string, categoryId: string, input: Record<string, unknown>) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, storeId } });
  if (!category) throw notFound('Catégorie introuvable');
  return prisma.category.update({ where: { id: categoryId }, data: input });
}

export async function deleteCategory(storeId: string, categoryId: string) {
  const category = await prisma.category.findFirst({ where: { id: categoryId, storeId } });
  if (!category) throw notFound('Catégorie introuvable');
  await prisma.category.update({ where: { id: categoryId }, data: { isActive: false } });
}