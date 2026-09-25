import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as supplierService from '../services/supplier.service';
import { supplierInputSchema, supplierUpdateSchema } from '../validators/supply.validator';

function parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error?.issues[0]?.message ?? 'Données invalides');
  return parsed.data as T;
}

export const listSuppliers = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await supplierService.listSuppliers(req.store.id, {
    search: req.query.search as string | undefined,
    activeOnly: req.query.activeOnly === 'true',
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getSupplierStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  res.json(await supplierService.getSupplierStats(req.store.id));
});

export const getSupplier = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  res.json(await supplierService.getSupplier(req.store.id, req.params.supplierId));
});

export const createSupplier = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const input = parse(supplierInputSchema, req.body);
  res.status(201).json(await supplierService.createSupplier(req.store.id, input));
});

export const updateSupplier = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const input = parse(supplierUpdateSchema, req.body);
  res.json(await supplierService.updateSupplier(req.store.id, req.params.supplierId, input));
});

export const deleteSupplier = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await supplierService.deleteSupplier(req.store.id, req.params.supplierId);
  res.status(204).end();
});
