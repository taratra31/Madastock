import bcrypt from 'bcryptjs';
import { createHash, randomUUID } from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../lib/prisma';
import type { JwtPayload } from '../types/express';
import { badRequest, conflict, tooManyRequests, unauthorized } from '../utils/httpError';
import { sendVerifyCodeEmail } from './mailer.service';
import type { LoginInput, RegisterInput, VerifyEmailInput } from '../validators/auth.validator';

const BCRYPT_ROUNDS = 10;
const CODE_TTL_MS = env.VERIFY_CODE_TTL_MINUTES * 60 * 1000;
const RESEND_COOLDOWN_MS = 60_000;

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  isSuperAdmin: true,
  isActive: true,
  emailVerified: true,
  createdAt: true,
  memberships: {
    where: { store: { active: true } },
    select: {
      id: true,
      storeId: true,
      role: true,
      isOwner: true,
      canManageAll: true,
      store: { select: { id: true, name: true, active: true } },
    },
  },
} as const;

export function durationToMs(value: string): number {
  const match = /^(\d+)([smhd])?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid duration: ${value}`);
  }
  const n = Number(match[1]);
  const unit = match[2] ?? 's';
  const mult: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return n * mult[unit];
}

export function signToken(user: { id: string; email: string }): string {
  const payload: JwtPayload = { sub: user.id, email: user.email };
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

function signRefreshToken(session: { id: string; user: { id: string; email: string } }): string {
  const payload: JwtPayload & { jti: string } = { sub: session.user.id, email: session.user.email, jti: session.id };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'] });
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function createSession(
  user: { id: string; email: string },
  meta?: SessionMeta
): Promise<string> {
  const id = randomUUID();
  const refreshToken = signRefreshToken({ id, user });
  await prisma.session.create({
    data: {
      id,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      userAgent: meta?.userAgent ?? null,
      ip: meta?.ip ?? null,
      expiresAt: new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });
  return refreshToken;
}

async function verifyRefreshToken(refreshToken: string): Promise<{ sessionId: string; user: { id: string; email: string } }> {
  let payload: JwtPayload & { jti?: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_SECRET) as JwtPayload & { jti?: string };
  } catch {
    throw unauthorized('Session expirée ou invalide');
  }

  if (!payload.jti) {
    throw unauthorized('Session invalide');
  }

  const session = await prisma.session.findUnique({ where: { id: payload.jti } });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Session expirée ou révoquée');
  }

  if (session.tokenHash !== hashToken(refreshToken)) {
    throw unauthorized('Session invalide');
  }

  return { sessionId: session.id, user: { id: payload.sub, email: payload.email } };
}

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict('Un compte existe déjà avec cet email');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const code = generateCode();
  const now = new Date();

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone ?? null,
      emailVerifyCode: code,
      emailVerifySentAt: now,
      emailVerifyExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });

  try {
    await sendVerifyCodeEmail(input.email, code);
  } catch {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    throw badRequest("Impossible d'envoyer le code de vérification par e-mail");
  }

  return {
    requiresVerification: true,
    email: input.email,
    devCode: env.NODE_ENV === 'production' ? undefined : code,
  };
}

export async function login(input: LoginInput, meta?: SessionMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    throw unauthorized('Email ou mot de passe incorrect');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw unauthorized('Email ou mot de passe incorrect');
  }

  if (!user.isActive) {
    throw unauthorized('Ce compte est désactivé');
  }

  if (!user.emailVerified) {
    return { requiresVerification: true, email: user.email };
  }

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: SAFE_USER_SELECT,
  });

  if (!safeUser || !safeUser.isActive) {
    throw unauthorized('Email ou mot de passe incorrect');
  }

  const refreshToken = await createSession(user, meta);
  return { token: signToken(user), refreshToken, user: safeUser };
}

export async function verifyEmail(input: VerifyEmailInput, meta?: SessionMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.emailVerifyCode) {
    throw unauthorized('Code invalide ou expiré');
  }

  if (user.emailVerifyExpiresAt && user.emailVerifyExpiresAt.getTime() < Date.now()) {
    throw unauthorized('Code expiré, demandez un nouveau code');
  }

  if (user.emailVerifyCode !== input.code) {
    throw unauthorized('Code invalide');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: true, emailVerifyCode: null, emailVerifySentAt: null, emailVerifyExpiresAt: null },
  });

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: SAFE_USER_SELECT,
  });

  if (!safeUser || !safeUser.isActive) {
    throw unauthorized('Compte introuvable');
  }

  const refreshToken = await createSession(user, meta);
  return { token: signToken(user), refreshToken, user: safeUser };
}

export async function refreshSession(refreshToken: string) {
  const { sessionId, user } = await verifyRefreshToken(refreshToken);

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: SAFE_USER_SELECT,
  });

  if (!safeUser || !safeUser.isActive) {
    throw unauthorized('Compte introuvable');
  }

  const newRefresh = signRefreshToken({ id: sessionId, user });
  await prisma.session.update({
    where: { id: sessionId },
    data: {
      tokenHash: hashToken(newRefresh),
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + durationToMs(env.JWT_REFRESH_EXPIRES_IN)),
    },
  });

  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  return { token: signToken(user), refreshToken: newRefresh, user: safeUser };
}

export async function logout(refreshToken?: string): Promise<void> {
  if (!refreshToken) {
    return;
  }
  await prisma.session.updateMany({
    where: { tokenHash: hashToken(refreshToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function resendCode(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: 'Si cet e-mail existe, un nouveau code a été envoyé.' };
  }

  if (user.emailVerified) {
    return { message: 'Cette adresse e-mail est déjà vérifiée.' };
  }

  if (user.emailVerifySentAt && user.emailVerifySentAt.getTime() > Date.now() - RESEND_COOLDOWN_MS) {
    throw tooManyRequests('Veuillez patienter avant de demander un nouveau code');
  }

  const code = generateCode();
  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifyCode: code,
      emailVerifySentAt: now,
      emailVerifyExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });

  try {
    await sendVerifyCodeEmail(email, code);
  } catch {
    throw badRequest("Impossible d'envoyer le code de vérification par e-mail");
  }

  return { message: 'Un nouveau code a été envoyé.' };
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      isSuperAdmin: true,
      emailVerified: true,
      isActive: true,
      createdAt: true,
      memberships: {
        where: { store: { active: true } },
        select: {
          id: true,
          storeId: true,
          role: true,
          isOwner: true,
          canManageAll: true,
          store: { select: { id: true, name: true, country: true, currency: true, active: true } },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw unauthorized('Compte introuvable');
  }

  return user;
}