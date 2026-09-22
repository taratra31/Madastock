import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as authService from '../services/auth.service';
import { loginSchema, registerSchema } from '../validators/auth.validator';

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const result = await authService.register(parsed.data);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const result = await authService.login(parsed.data);
  res.status(200).json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw badRequest('Utilisateur non identifié');
  }
  const user = await authService.getMe(req.user.id);
  res.status(200).json({ user });
});