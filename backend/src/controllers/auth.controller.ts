import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest, unauthorized } from '../utils/httpError';
import {
  durationToMs,
  getMe,
  login as svcLogin,
  logout as svcLogout,
  refreshSession,
  register as svcRegister,
  resendCode as svcResendCode,
  verifyEmail as svcVerifyEmail,
  type SessionMeta,
} from '../services/auth.service';
import { loginSchema, registerSchema, resendCodeSchema, verifyEmailSchema } from '../validators/auth.validator';
import { env } from '../config/env';

const ACCESS_COOKIE = 'ms_access';
const REFRESH_COOKIE = 'ms_refresh';
const SECURE = env.NODE_ENV === 'production';

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: SECURE,
  path: '/',
};

function setAuthCookies(
  res: Response,
  auth: { token: string; refreshToken: string }
): void {
  res.cookie(ACCESS_COOKIE, auth.token, {
    ...cookieOptions,
    maxAge: durationToMs(env.JWT_EXPIRES_IN),
  });
  res.cookie(REFRESH_COOKIE, auth.refreshToken, {
    ...cookieOptions,
    maxAge: durationToMs(env.JWT_REFRESH_EXPIRES_IN),
  });
}

function clearAuthCookies(res: Response): void {
  res.clearCookie(ACCESS_COOKIE, cookieOptions);
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

function sessionMeta(req: Request): SessionMeta {
  return { userAgent: req.get('user-agent'), ip: req.ip };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const result = await svcRegister(parsed.data);
  res.status(201).json(result);
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const result = await svcLogin(parsed.data, sessionMeta(req));
  if ('requiresVerification' in result) {
    res.status(200).json(result);
    return;
  }
  setAuthCookies(res, result);
  res.status(200).json(result);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw badRequest('Utilisateur non identifié');
  }
  const user = await getMe(req.user.id);
  res.status(200).json({ user });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const parsed = verifyEmailSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const result = await svcVerifyEmail(parsed.data, sessionMeta(req));
  setAuthCookies(res, result);
  res.status(200).json(result);
});

export const resendCode = asyncHandler(async (req: Request, res: Response) => {
  const parsed = resendCodeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw badRequest('Données invalides', parsed.error.flatten());
  }

  const result = await svcResendCode(parsed.data.email);
  res.status(200).json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  if (!refreshToken) {
    throw unauthorized('Session expirée');
  }

  const result = await refreshSession(refreshToken);
  setAuthCookies(res, result);
  res.status(200).json(result);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  await svcLogout(refreshToken);
  clearAuthCookies(res);
  res.status(204).send();
});