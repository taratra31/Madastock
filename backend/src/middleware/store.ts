import type { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { forbidden, unauthorized } from '../utils/httpError';

export async function requireStoreAccess(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    return next(unauthorized('Authentification requise'));
  }

  const storeId = req.headers['x-store-id'] as string | undefined;

  if (!storeId) {
    return next(forbidden('En-tête X-Store-Id requis'));
  }

  const membership = await prisma.storeMember.findUnique({
    where: {
      storeId_userId: { storeId, userId: req.user.id },
    },
    select: {
      role: true,
      isOwner: true,
      canManageAll: true,
      store: { select: { id: true, active: true } },
    },
  });

  if (!membership) {
    return next(forbidden('Vous n\'êtes pas membre de cette boutique'));
  }

  if (!membership.store.active) {
    return next(forbidden('Cette boutique est désactivée'));
  }

  req.store = {
    id: membership.store.id,
    role: membership.role,
    isOwner: membership.isOwner,
    canManageAll: membership.canManageAll,
  };

  return next();
}

export function requireOwnerOrAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.store) {
    return next(forbidden('Contexte boutique manquant'));
  }
  if (!req.store.isOwner && req.store.role !== 'ADMIN' && !req.store.canManageAll) {
    return next(forbidden('Droits insuffisants'));
  }
  return next();
}

export function requireOwner(req: Request, _res: Response, next: NextFunction): void {
  if (!req.store) {
    return next(forbidden('Contexte boutique manquant'));
  }
  if (!req.store.isOwner) {
    return next(forbidden('Seul le propriétaire peut effectuer cette action'));
  }
  return next();
}
