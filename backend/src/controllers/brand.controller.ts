import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as brandService from '../services/brand.service';
import { brandInputSchema, brandUpdateSchema } from '../validators/supply.validator';

function parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error?.issues[0]?.message ?? 'Données invalides');
  return parsed.data as T;
}

export const listBrands = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  res.json(
    await brandService.listBrands(req.store.id, {
      search: req.query.search as string | undefined,
      activeOnly: req.query.activeOnly === 'true',
      withCounts: req.query.withCounts !== 'false',
    }),
  );
});

export const getBrandStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  res.json(await brandService.getBrandStats(req.store.id));
});

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const input = parse(brandInputSchema, req.body);
  res.status(201).json(await brandService.createBrand(req.store.id, input));
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const input = parse(brandUpdateSchema, req.body);
  res.json(await brandService.updateBrand(req.store.id, req.params.brandId, input));
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await brandService.deleteBrand(req.store.id, req.params.brandId);
  res.status(204).end();
});
