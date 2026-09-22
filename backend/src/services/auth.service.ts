import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../lib/prisma';
import type { JwtPayload } from '../types/express';
import { conflict, unauthorized } from '../utils/httpError';
import type { LoginInput, RegisterInput } from '../validators/auth.validator';

const BCRYPT_ROUNDS = 10;

export function signToken(user: { id: string; email: string }): string {
  const payload: JwtPayload = { sub: user.id, email: user.email };
  const options: SignOptions = { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw conflict('Un compte existe déjà avec cet email');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      phone: input.phone ?? null,
    },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      createdAt: true,
      memberships: {
        select: {
          id: true,
          storeId: true,
          role: true,
          isOwner: true,
          store: { select: { id: true, name: true } },
        },
      },
    },
  });

  return { token: signToken(user), user };
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

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      fullName: true,
      phone: true,
      avatarUrl: true,
      isSuperAdmin: true,
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
    },
  });

  if (!safeUser) {
    throw unauthorized('Email ou mot de passe incorrect');
  }

  return { token: signToken(user), user: safeUser };
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