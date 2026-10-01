import type { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as warehouseService from '../services/warehouse.service';

const createSchema = z.object({
  name: z.string().min(1, 'Nom obligatoire').max(80),
  address: z.string().max(200).nullish(),
  isMain: z.boolean().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  address: z.string().max(200).nullish(),
  isMain: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const transferSchema = z.object({
  productId: z.string().min(1, 'Produit invalide'),
  variantId: z.string().min(1).nullish(),
  fromWarehouseId: z.string().min(1, 'Dépôt de départ invalide'),
  toWarehouseId: z.string().min(1, 'Dépôt d\'arrivée invalide'),
  quantity: z.coerce.number().positive('Quantité invalide'),
  reason: z.string().max(200).nullish(),
});

export const listWarehouses = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  res.json(await warehouseService.listWarehouses(req.store.id));
});

export const createWarehouse = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const input = createSchema.parse(req.body);
  const warehouse = await warehouseService.createWarehouse(req.store.id, input);
  res.status(201).json(warehouse);
});

export const updateWarehouse = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const input = updateSchema.parse(req.body);
  const warehouse = await warehouseService.updateWarehouse(req.store.id, req.params.id, input);
  res.json(warehouse);
});

export const deleteWarehouse = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await warehouseService.deleteWarehouse(req.store.id, req.params.id);
  res.status(204).send();
});

export const transferStock = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const input = transferSchema.parse(req.body);
  const result = await warehouseService.transferStock(req.store.id, input);
  res.status(201).json(result);
});
