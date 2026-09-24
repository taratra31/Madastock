import bcrypt from 'bcryptjs';
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

const SAFE_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  avatarUrl: true,
  isSuperAdmin: true,
  emailVerified: true,
  createdAt: true,
  memberships: {
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

export function signToken(user: { id: string; email: string }): string {
  const payload: JwtPayload = { sub: user.id, email: user.email };
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
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
  } catch (error) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    throw badRequest(`Impossible d'envoyer le code de vérification par e-mail (${(error as Error).message})`);
  }

  return {
    requiresVerification: true,
    email: input.email,
    devCode: env.NODE_ENV === 'production' ? undefined : code,
  };
}

export async function login(input: LoginInput) {
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

  if (!safeUser) {
    throw unauthorized('Email ou mot de passe incorrect');
  }

  return { token: signToken(user), user: safeUser };
}

export async function verifyEmail(input: VerifyEmailInput) {
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

  if (!safeUser) {
    throw unauthorized('Compte introuvable');
  }

  return { token: signToken(user), user: safeUser };
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
  } catch (error) {
    throw badRequest(`Impossible d'envoyer le code de vérification par e-mail (${(error as Error).message})`);
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