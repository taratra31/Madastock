import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as dashboardService from '../services/dashboard.service';

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const stats = await dashboardService.getDashboardStats(req.store.id);
  res.json(stats);
});