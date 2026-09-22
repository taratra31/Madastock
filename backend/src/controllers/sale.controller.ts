import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as saleService from '../services/sale.service';

export const listSales = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await saleService.listSales(req.store.id, {
    search: req.query.search as string | undefined,
    status: req.query.status as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getSale = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const sale = await saleService.getSale(req.store.id, req.params.saleId);
  res.json(sale);
});

export const createSale = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const sale = await saleService.createSale(req.store.id, req.user.id, {
    ...req.body,
    userRole: req.store.role,
    isOwner: req.store.isOwner,
    canManageAll: req.store.canManageAll,
  });
  res.status(201).json(sale);
});

export const cancelSale = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const sale = await saleService.cancelSale(
    req.store.id,
    req.params.saleId,
    req.body.reason as string | undefined
  );
  res.json(sale);
});
