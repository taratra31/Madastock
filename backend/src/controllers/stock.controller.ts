import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as stockService from '../services/stock.service';

export const listStock = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await stockService.listStock(req.store.id, {
    search: req.query.search as string | undefined,
    lowStock: req.query.lowStock === 'true',
    warehouseId: req.query.warehouseId as string | undefined,
    expiry: req.query.expiry as string | undefined,
  });
  res.json(result);
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  // Le droit d'écrire le stock est contrôlé par `requirePermission(STOCK_WRITE)`
  // sur la route (l'ancien test en dur OWNER/ADMIN bloquait à tort les
  // gestionnaires de stock et les managers).
  const stock = await stockService.adjustStock(req.store.id, req.body);
  res.json(stock);
});

export const listWarehouses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const warehouses = await stockService.listWarehouses(req.store.id);
  res.json(warehouses);
});

export const listMovements = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await stockService.listMovements(req.store.id, {
    productId: req.query.productId as string | undefined,
    warehouseId: req.query.warehouseId as string | undefined,
    movementType: req.query.type as string | undefined,
    referenceType: req.query.referenceType as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    search: req.query.search as string | undefined,
    page: req.query.page as string | undefined,
    pageSize: req.query.pageSize as string | undefined,
  });
  res.json(result);
});