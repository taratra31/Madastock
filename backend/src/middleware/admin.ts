import type { NextFunction, Request, Response } from 'express';
import prisma from '../lib/prisma';
import { forbidden, unauthorized } from '../utils/httpError';

/**
 * Vérifie que l'utilisateur authentifié est bien superadmin.
 * La vérification se fait TOUJOURS contre la base de données, jamais le token.
 */
export async function requireSuperAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    return next(unauthorized('Authentification requise'));
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { isSuperAdmin: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return next(unauthorized('Compte introuvable'));
  }

  if (!user.isSuperAdmin) {
    return next(forbidden('Accès réservé à l\'administrateur'));
  }

  return next();
}