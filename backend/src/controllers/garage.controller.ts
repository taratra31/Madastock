import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import { getGarageStats } from '../services/garage.service';

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const stats = await getGarageStats(req.store.id);
  res.json(stats);
});