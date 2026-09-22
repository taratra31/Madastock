import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as mechanicService from '../services/mechanic.service';

export const listMechanics = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await mechanicService.listMechanics(req.store.id);
  res.json(result);
});

export const getMechanic = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const mechanic = await mechanicService.getMechanic(req.store.id, req.params.mechanicId);
  res.json(mechanic);
});

export const createMechanic = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const mechanic = await mechanicService.createMechanic(req.store.id, req.body);
  res.status(201).json(mechanic);
});

export const updateMechanic = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const mechanic = await mechanicService.updateMechanic(req.store.id, req.params.mechanicId, req.body);
  res.json(mechanic);
});

export const deleteMechanic = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await mechanicService.deleteMechanic(req.store.id, req.params.mechanicId);
  res.status(204).end();
});