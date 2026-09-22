import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { JwtPayload } from '../types/express';
import { unauthorized } from '../utils/httpError';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next(unauthorized('Token manquant'));
  }

  const token = header.slice('Bearer '.length);

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & JwtPayload;
    req.user = { id: decoded.sub, email: decoded.email };
    return next();
  } catch {
    return next(unauthorized('Token invalide ou expiré'));
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): NextFunction | void {
  if (!req.user) {
    return next(unauthorized('Authentification requise'));
  }
  return next();
}