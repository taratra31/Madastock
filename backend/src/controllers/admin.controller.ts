import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as adminService from '../services/admin.service';
import {
  listQuerySchema,
  updateStoreStatusSchema,
  updateSubscriptionSchema,
  updateUserStatusSchema,
} from '../validators/admin.validator';

export const getOverview = asyncHandler(async (_req: Request, res: Response) => {
  res.json(await adminService.getOverview());
});

export const listStores = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Paramètres invalides', parsed.error.flatten());
  res.json(await adminService.listStores(parsed.data));
});

export const setStoreStatus = asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateStoreStatusSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Données invalides', parsed.error.flatten());
  const storeId = req.params.storeId as string;
  res.json(await adminService.updateStore(storeId, parsed.data));
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Paramètres invalides', parsed.error.flatten());
  res.json(await adminService.listUsers(parsed.data));
});

export const setUserStatus = asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateUserStatusSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Données invalides', parsed.error.flatten());
  if (!req.user) throw badRequest('Utilisateur non identifié');
  const userId = req.params.userId as string;
  res.json(await adminService.updateUser(userId, parsed.data, req.user.id));
});

export const listSubscriptions = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Paramètres invalides', parsed.error.flatten());
  res.json(await adminService.listSubscriptions(parsed.data));
});

export const updateSubscription = asyncHandler(async (req: Request, res: Response) => {
  const parsed = updateSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) throw badRequest('Données invalides', parsed.error.flatten());
  const id = req.params.subscriptionId as string;
  res.json(await adminService.updateSubscription(id, parsed.data));
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) throw badRequest('Paramètres invalides', parsed.error.flatten());
  res.json(await adminService.listPayments(parsed.data));
});