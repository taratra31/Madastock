import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as report from '../services/report.service';
import { canViewCost } from '../middleware/rbac';

export const salesReport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const period = report.parsePeriod(req.query.from as string | undefined, req.query.to as string | undefined);
  res.json(await report.salesReport(req.store.id, period, { includeCosts: canViewCost(req) }));
});

export const rotationReport = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const period = report.parsePeriod(req.query.from as string | undefined, req.query.to as string | undefined);
  res.json(await report.rotationReport(req.store.id, period, { includeCosts: canViewCost(req) }));
});

export const productPerformance = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const period = report.parsePeriod(req.query.from as string | undefined, req.query.to as string | undefined);
  res.json(await report.productPerformance(req.store.id, period, { includeCosts: canViewCost(req) }));
});
