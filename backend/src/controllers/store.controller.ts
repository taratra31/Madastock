import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as storeService from '../services/store.service';
import {
  createStoreSchema,
  updateStoreSchema,
  addMemberSchema,
  updateMemberSchema,
} from '../validators/store.validator';

export const createStore = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw badRequest('Utilisateur non identifié');
  }

  const parsed = createStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const store = await storeService.createStore(req.user.id, parsed.data);
  res.status(201).json({ store });
});

export const listStores = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw badRequest('Utilisateur non identifié');
  }

  const memberships = await storeService.listStores(req.user.id);
  res.status(200).json({ memberships });
});

export const getStore = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.store) {
    throw badRequest('Contexte boutique manquant');
  }

  const store = await storeService.getStore(req.store.id, req.user.id);
  res.status(200).json({ store });
});

export const updateStore = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.store) {
    throw badRequest('Contexte boutique manquant');
  }

  const parsed = updateStoreSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const store = await storeService.updateStore(req.store.id, req.user.id, parsed.data);
  res.status(200).json({ store });
});

export const deleteStore = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.store) {
    throw badRequest('Contexte boutique manquant');
  }

  await storeService.deleteStore(req.store.id, req.user.id);
  res.status(204).send();
});

export const addMember = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.store) {
    throw badRequest('Contexte boutique manquant');
  }

  const parsed = addMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const member = await storeService.addMember(req.store.id, parsed.data, req.user.id);
  res.status(201).json({ member });
});

export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) {
    throw badRequest('Contexte boutique manquant');
  }

  const members = await storeService.listMembers(req.store.id);
  res.status(200).json({ members });
});

export const updateMember = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.store) {
    throw badRequest('Contexte boutique manquant');
  }

  const memberId = req.params.memberId;
  if (!memberId) {
    throw badRequest('ID de membre requis');
  }

  const parsed = updateMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const member = await storeService.updateMember(memberId, req.store.id, parsed.data, req.user.id);
  res.status(200).json({ member });
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user || !req.store) {
    throw badRequest('Contexte boutique manquant');
  }

  const memberId = req.params.memberId;
  if (!memberId) {
    throw badRequest('ID de membre requis');
  }

  await storeService.removeMember(memberId, req.store.id, req.user.id);
  res.status(204).send();
});
