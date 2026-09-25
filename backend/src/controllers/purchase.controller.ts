import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as purchaseService from '../services/purchase.service';
import { purchaseInputSchema, purchaseStatusSchema } from '../validators/supply.validator';

function parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error?.issues[0]?.message ?? 'Données invalides');
  return parsed.data as T;
}

export const listPurchases = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  res.json(
    await purchaseService.listPurchases(req.store.id, {
      search: req.query.search as string | undefined,
      status: req.query.status as string | undefined,
      supplierId: req.query.supplierId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
  );
});

export const getPurchaseStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  res.json(await purchaseService.getPurchaseStats(req.store.id));
});

export const getPurchase = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  res.json(await purchaseService.getPurchase(req.store.id, req.params.purchaseId));
});

export const createPurchase = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const input = parse(purchaseInputSchema, req.body);
  res.status(201).json(await purchaseService.createPurchase(req.store.id, req.user.id, input));
});

export const setPurchaseStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const input = parse(purchaseStatusSchema, req.body);
  res.json(
    await purchaseService.setPurchaseStatus(req.store.id, req.user.id, req.params.purchaseId, input.status),
  );
});

export const deletePurchase = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await purchaseService.deletePurchase(req.store.id, req.params.purchaseId);
  res.status(204).end();
});
