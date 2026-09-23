import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import * as publicService from '../services/public.service';

export const getCatalogue = asyncHandler(async (req: Request, res: Response) => {
  const catalogue = await publicService.getPublicCatalogue(req.params.slug);
  res.json(catalogue);
});

export const getPlans = asyncHandler(async (_req: Request, res: Response) => {
  const plans = await publicService.getPublicPlans();
  res.json(plans);
});

export const getLiveStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await publicService.getPublicLiveStats(req.params.slug);
  res.json(stats);
});

export const getStoreInfo = asyncHandler(async (req: Request, res: Response) => {
  const store = await publicService.getPublicStore(req.params.slug);
  res.json(store);
});
