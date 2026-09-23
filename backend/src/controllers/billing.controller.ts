import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as billingService from '../services/billing.service';

export const getBilling = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const data = await billingService.getOverview(req.store.id);
  res.json(data);
});

export const createCheckout = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const planId = req.body.planId as string | undefined;
  if (!planId) throw badRequest('planId requis');
  const result = await billingService.createCheckout(req.store.id, planId);
  res.json(result);
});

export const refreshOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await billingService.refreshOrder(req.store.id, req.params.orderId);
  res.json(result);
});

export const webhook = asyncHandler(async (req: Request, res: Response) => {
  const result = await billingService.handleWebhook(req.body ?? {});
  res.json({ ok: true, ...result });
});