import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../lib/prisma';
import type { JwtPayload } from '../types/express';
import { unauthorized } from '../utils/httpError';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  let token: string | undefined;

  if (header && header.startsWith('Bearer ')) {
    token = header.slice('Bearer '.length);
  } else {
    token = req.cookies?.ms_access as string | undefined;
  }

  if (!token) {
    return next(unauthorized('Token manquant'));
  }

  let decoded: (JwtPayload & { typ?: string }) & jwt.JwtPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as typeof decoded;
  } catch {
    return next(unauthorized('Token invalide ou expiré'));
  }

  // Un refresh token ne doit jamais donner accès à l'API, même s'il est
  // présenté en Bearer (token volé depuis un cookie, un log, un proxy...).
  if (decoded.typ === 'refresh') {
    return next(unauthorized('Token invalide ou expiré'));
  }

  if (!decoded.sub) {
    return next(unauthorized('Token invalide ou expiré'));
  }

  // Un compte désactivé ou supprimé perd l'accès IMMÉDIATEMENT, même si son
  // access token est encore valide (il peut rester valide jusqu'à 7 jours).
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: { id: true, email: true, isActive: true, deletedAt: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return next(unauthorized('Compte désactivé'));
    }

    req.user = { id: user.id, email: user.email };
    return next();
  } catch {
    return next(unauthorized('Authentification indisponible'));
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): NextFunction | void {
  if (!req.user) {
    return next(unauthorized('Authentification requise'));
  }
  return next();
}