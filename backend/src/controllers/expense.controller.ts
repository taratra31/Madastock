import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as expenseService from '../services/expense.service';
import { expenseInputSchema, expenseUpdateSchema } from '../validators/supply.validator';

function parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error?.issues[0]?.message ?? 'Données invalides');
  return parsed.data as T;
}

export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  res.json(
    await expenseService.listExpenses(req.store.id, {
      search: req.query.search as string | undefined,
      category: req.query.category as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
  );
});

export const getExpenseStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  res.json(await expenseService.getExpenseStats(req.store.id));
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const input = parse(expenseInputSchema, req.body);
  res.status(201).json(await expenseService.createExpense(req.store.id, req.user.id, input));
});

export const updateExpense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const input = parse(expenseUpdateSchema, req.body);
  res.json(await expenseService.updateExpense(req.store.id, req.user.id, req.params.expenseId, input));
});

export const deleteExpense = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await expenseService.deleteExpense(req.store.id, req.params.expenseId);
  res.status(204).end();
});
