import prisma from '../lib/prisma';
import { badRequest, notFound } from '../utils/httpError';
import type { ExpenseInput } from '../validators/supply.validator';
import { recordCashMovement, removeCashMovements } from './cash.service';

export interface ExpenseQuery {
  search?: string;
  category?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

function serializeExpense(e: any) {
  return {
    id: e.id,
    category: e.category,
    description: e.description,
    amountAr: Number(e.amountAr),
    incurredAt: e.incurredAt,
    paymentMethod: e.paymentMethod,
    receiptUrl: e.receiptUrl,
    createdAt: e.createdAt,
  };
}

export async function listExpenses(storeId: string, query: ExpenseQuery) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
  const where: Record<string, any> = { storeId };

  if (query.category) where.category = query.category;
  if (query.search) {
    const q = query.search.trim();
    where.OR = [{ description: { contains: q } }, { category: { contains: q } }];
  }
  if (query.from || query.to) {
    where.incurredAt = {};
    if (query.from) where.incurredAt.gte = new Date(query.from);
    if (query.to) where.incurredAt.lte = new Date(query.to);
  }

  const [expenses, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: [{ incurredAt: 'desc' }, { createdAt: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.expense.count({ where }),
  ]);

  return {
    data: expenses.map(serializeExpense),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getExpense(storeId: string, expenseId: string) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, storeId },
  });
  if (!expense) throw notFound('Dépense introuvable');
  return serializeExpense(expense);
}

export async function getExpenseStats(storeId: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [monthAgg, prevAgg, todayAgg, byCategory] = await Promise.all([
    prisma.expense.aggregate({
      where: { storeId, incurredAt: { gte: startOfMonth, lt: startOfNextMonth } },
      _sum: { amountAr: true },
      _count: true,
    }),
    prisma.expense.aggregate({
      where: { storeId, incurredAt: { gte: startOfPrevMonth, lt: startOfMonth } },
      _sum: { amountAr: true },
    }),
    prisma.expense.aggregate({
      where: { storeId, incurredAt: { gte: startOfDay } },
      _sum: { amountAr: true },
    }),
    prisma.expense.groupBy({
      by: ['category'],
      where: { storeId, incurredAt: { gte: startOfMonth, lt: startOfNextMonth } },
      _sum: { amountAr: true },
      _count: true,
      orderBy: { _sum: { amountAr: 'desc' } },
    }),
  ]);

  const monthTotal = Number(monthAgg._sum.amountAr ?? 0);
  const prevTotal = Number(prevAgg._sum.amountAr ?? 0);

  return {
    monthTotalAr: monthTotal,
    monthCount: monthAgg._count,
    prevMonthTotalAr: prevTotal,
    variationPct: prevTotal > 0 ? Math.round(((monthTotal - prevTotal) / prevTotal) * 100) : null,
    todayTotalAr: Number(todayAgg._sum.amountAr ?? 0),
    byCategory: byCategory.map((c) => ({
      category: c.category,
      amountAr: Number(c._sum.amountAr ?? 0),
      count: c._count,
      sharePct: monthTotal > 0 ? Math.round((Number(c._sum.amountAr ?? 0) / monthTotal) * 100) : 0,
    })),
  };
}

export async function createExpense(storeId: string, userId: string, input: ExpenseInput) {
  if (Number(input.amountAr) <= 0) throw badRequest('Le montant doit être supérieur à 0');

  const expense = await prisma.expense.create({
    data: {
      storeId,
      category: input.category,
      description: input.description || null,
      amountAr: Number(input.amountAr),
      incurredAt: input.incurredAt ? new Date(input.incurredAt) : new Date(),
      paymentMethod: input.paymentMethod ?? 'CASH',
      receiptUrl: input.receiptUrl?.trim() || null,
      createdById: userId,
    },
  });

  if ((input.paymentMethod ?? 'CASH') === 'CASH') {
    await recordCashMovement({
      storeId,
      userId,
      transactionType: 'EXPENSE',
      amountAr: Number(input.amountAr),
      method: 'CASH',
      source: 'EXPENSE',
      expenseId: expense.id,
      description: input.description || `Dépense ${input.category}`,
    });
  }

  return serializeExpense(expense);
}

export async function updateExpense(
  storeId: string,
  userId: string,
  expenseId: string,
  input: Partial<ExpenseInput>,
) {
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, storeId } });
  if (!expense) throw notFound('Dépense introuvable');
  if (input.amountAr !== undefined && Number(input.amountAr) <= 0) {
    throw badRequest('Le montant doit être supérieur à 0');
  }

  const updated = await prisma.expense.update({
    where: { id: expense.id },
    data: {
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.amountAr !== undefined ? { amountAr: Number(input.amountAr) } : {}),
      ...(input.incurredAt !== undefined ? { incurredAt: new Date(input.incurredAt) } : {}),
      ...(input.paymentMethod !== undefined ? { paymentMethod: input.paymentMethod } : {}),
      ...(input.receiptUrl !== undefined ? { receiptUrl: input.receiptUrl.trim() || null } : {}),
    },
  });

  // La sortie de caisse suit la dépense : on la remplace pour rester cohérent.
  await removeCashMovements({ storeId, expenseId: expense.id });
  if (updated.paymentMethod === 'CASH') {
    await recordCashMovement({
      storeId,
      userId,
      transactionType: 'EXPENSE',
      amountAr: Number(updated.amountAr),
      method: 'CASH',
      source: 'EXPENSE',
      expenseId: updated.id,
      description: updated.description || `Dépense ${updated.category}`,
    });
  }

  return serializeExpense(updated);
}

export async function deleteExpense(storeId: string, expenseId: string) {
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, storeId } });
  if (!expense) throw notFound('Dépense introuvable');
  await removeCashMovements({ storeId, expenseId: expense.id });
  await prisma.expense.delete({ where: { id: expense.id } });
  return { success: true };
}
