import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as vehicleService from '../services/vehicle.service';

export const listVehicles = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await vehicleService.listVehicles(req.store.id, {
    search: req.query.search as string | undefined,
    customerId: req.query.customerId as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getVehicle = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const vehicle = await vehicleService.getVehicle(req.store.id, req.params.vehicleId);
  res.json(vehicle);
});

export const createVehicle = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const vehicle = await vehicleService.createVehicle(req.store.id, req.body);
  res.status(201).json(vehicle);
});

export const updateVehicle = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const vehicle = await vehicleService.updateVehicle(req.store.id, req.params.vehicleId, req.body);
  res.json(vehicle);
});

export const deleteVehicle = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await vehicleService.deleteVehicle(req.store.id, req.params.vehicleId);
  res.status(204).end();
});