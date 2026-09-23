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
  if (!req.user) throw badRequest('Utilisateur manquant');
  const planId = req.body.planId as string | undefined;
  if (!planId) throw badRequest('planId requis');
  const result = await billingService.createCheckout(req.store.id, req.user.id, planId);
  res.json(result);
});

export const refreshOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await billingService.refreshOrder(req.store.id, req.params.orderId);
  res.json(result);
});

export const getPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const reference = req.params.reference as string | undefined;
  if (!reference) throw badRequest('reference requis');
  // La route ne fait pas confiance au client : on force storeId depuis le middleware auth.
  const result = await billingService.getPaymentStatusInfo(req.store.id, reference);
  res.json(result);
});

/**
 * Webhook Ariari — reçoit le body BRUT (Buffer) grâce à express.raw() monté sur la route.
 * Pas de signature côté Ariari : le statut est revalidé par relecture de l'API.
 */
export const ariariWebhook = asyncHandler(async (req: Request, res: Response) => {
  const rawBody = req.body as Buffer;
  const result = await billingService.handleWebhook(rawBody);
  res.json({ ok: true, handled: result.handled });
});