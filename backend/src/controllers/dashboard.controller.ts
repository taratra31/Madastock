import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import { canViewCost } from '../middleware/rbac';
import * as dashboardService from '../services/dashboard.service';

export const getStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const stats = await dashboardService.getDashboardStats(req.store.id);

  // Un caissier voit son chiffre d'affaires, mais ni la valeur du stock
  // (coût × quantité) ni les marges : ces données viennent des prix d'achat.
  if (canViewCost(req)) return res.json(stats);

  const { totalStockValueAr, totalProfitMonth, topProducts, ...rest } = stats;
  return res.json({
    ...rest,
    totalStockValueAr: null,
    totalProfitMonth: null,
    topProducts: topProducts.map(({ costPriceAr, costAr, ...tp }) => tp),
  });
});