import type { NextFunction, Request, Response } from 'express';
import { forbidden } from '../utils/httpError';
import { can, type Permission } from '../lib/permissions';

/**
 * Garde-fou serveur : 403 si le rôle du membre de la boutique n'a pas
 * la permission. À poser sur CHAQUE route d'écriture (et sur les lectures
 * sensibles comme les coûts d'achat).
 */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.store) {
      return next(forbidden('Contexte boutique manquant'));
    }
    if (can(req.store.role, req.store.isOwner, permission)) {
      return next();
    }
    return next(
      forbidden(
        `Votre rôle (${req.store.role}) ne permet pas cette action (permission : ${permission}).`,
      ),
    );
  };
}

/** Variante pour les routes qui acceptent l'une OU l'autre permission. */
export function requireAnyPermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.store) {
      return next(forbidden('Contexte boutique manquant'));
    }
    if (permissions.some((p) => can(req.store!.role, req.store!.isOwner, p))) {
      return next();
    }
    return next(forbidden('Droits insuffisants pour cette action'));
  };
}

/** true si le membre peut voir les prix d'achat / marges. */
export function canViewCost(req: Request): boolean {
  if (!req.store) return false;
  return can(req.store.role, req.store.isOwner, 'cost.view');
}
