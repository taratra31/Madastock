import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as interactionService from '../services/interaction.service';

export const listInteractions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await interactionService.listInteractions(req.store.id, {
    customerId: req.query.customerId as string | undefined,
    leadId: req.query.leadId as string | undefined,
    workOrderId: req.query.workOrderId as string | undefined,
  });
  res.json(result);
});

export const createInteraction = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const interaction = await interactionService.createInteraction(req.store.id, req.user.id, req.body);
  res.status(201).json(interaction);
});

export const deleteInteraction = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await interactionService.deleteInteraction(req.store.id, req.params.interactionId);
  res.status(204).end();
});