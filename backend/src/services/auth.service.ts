import bcrypt from 'bcryptjs';
import { createHash, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';
import prisma from '../lib/prisma';
import type { JwtPayload } from '../types/express';
import {
  badRequest,
  serviceUnavailable,
  unauthorized,
} from '../utils/httpError';
import { sendPasswordResetEmail, sendVerifyCodeEmail } from './mailer.service';
import { sendOtpWhatsApp, whatsappOtpEnabled } from './whatsapp.service';
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '../validators/auth.validator';

const BCRYPT_ROUNDS = 10;
const CODE_TTL_MS = env.VERIFY_CODE_TTL_MINUTES * 60 * 1000;
const RESEND_COOLDOWN_MS = 60_000;
// Algorithme épinglé : empêche toute confusion d'algorithme sur la vérification.
const JWT_ALGORITHM = 'HS256' as const;
const JWT_SIGN_OPTIONS = { algorithm: JWT_ALGORITHM } as SignOptions;
const JWT_VERIFY_OPTIONS = { algorithms: [JWT_ALGORITHM] };
/**
 * Hash bcrypt factice, utilisé quand l'utilisateur n'existe pas : `bcrypt.compare`
 * coûte alors le même temps qu'un vrai mot de passe, ce qui empêche de deviner
 * l'existence d'un compte en mesurant le temps de réponse.
 */
const DUMMY_HASH = bcrypt.hashSync('mada-stock-timing-equalizer', BCRYPT_ROUNDS);

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
  const payload: JwtPayload & { typ: 'access' } = {
    sub: user.id,
    email: user.email,
    typ: 'access',
  };
  const options: SignOptions = {
    ...JWT_SIGN_OPTIONS,
    expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

function signRefreshToken(session: { id: string; user: { id: string; email: string } }): string {
  // `typ` distingue le refresh token de l'access token : un refresh token volé
  // ne peut plus être utilisé comme Bearer token sur l'API.
  // `rnd` rend chaque rotation unique même si deux appels tombent dans la même
  // seconde (sinon le hash stocké ne changeait pas et la rotation était inopérante).
  const payload: JwtPayload & { jti: string; typ: 'refresh'; rnd: string } = {
    sub: session.user.id,
    email: session.user.email,
    jti: session.id,
    typ: 'refresh',
    rnd: randomUUID(),
  };
  return jwt.sign(payload, env.JWT_SECRET, {
    ...JWT_SIGN_OPTIONS,
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as SignOptions['expiresIn'],
  });
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
  let payload: JwtPayload & { jti?: string; typ?: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_SECRET, JWT_VERIFY_OPTIONS) as JwtPayload & {
      jti?: string;
      typ?: string;
    };
  } catch {
    throw unauthorized('Session expirée ou invalide');
  }

  if (!payload.jti) {
    throw unauthorized('Session invalide');
  }

  // Un access token ne peut pas être utilisé pour rafraîchir une session.
  if (payload.typ && payload.typ !== 'refresh') {
    throw unauthorized('Session invalide');
  }

  const session = await prisma.session.findUnique({ where: { id: payload.jti } });
  if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
    throw unauthorized('Session expirée ou révoquée');
  }

  const storedHash = Buffer.from(session.tokenHash, 'utf8');
  const presentedHash = Buffer.from(hashToken(refreshToken), 'utf8');
  if (
    storedHash.length !== presentedHash.length ||
    !timingSafeEqual(storedHash, presentedHash)
  ) {
    throw unauthorized('Session invalide');
  }

  return { sessionId: session.id, user: { id: payload.sub, email: payload.email } };
}

/** Code OTP à 6 chiffres issu d'une source cryptographiquement sûre. */
function generateCode(): string {
  return String(randomInt(100000, 1000000));
}

/** Comparaison à temps constant d'un code OTP (évite les fuites par timing). */
function codeEquals(a: string, b: string): boolean {
  const bufferA = Buffer.from(String(a), 'utf8');
  const bufferB = Buffer.from(String(b), 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Forme canonique d'un numéro : les 9 derniers chiffres du format local.
 * 034 00 00 00 0 -> 340000000 | +261 34 00 00 00 0 -> 340000000
 * (les deux écritures doivent tomber sur la même recherche).
 */
export function phoneSuffix(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (digits.length < 6) return null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('261') && digits.length > 11) digits = digits.slice(3);
  if (digits.startsWith('0') && digits.length > 9) digits = digits.slice(1);
  return digits.length >= 9 ? digits.slice(-9) : digits;
}

/**
 * Connexion avec un seul champ : l'utilisateur saisit son email OU son numéro
 * de téléphone, dans n'importe quel format.
 */
async function findUserByEmailOrPhone(raw: string) {
  if (!raw) return null;
  if (raw.includes('@')) {
    return prisma.user.findUnique({ where: { email: raw.toLowerCase() } });
  }
  const suffix = phoneSuffix(raw);
  if (!suffix) return null;
  return prisma.user.findFirst({
    where: { phone: { contains: suffix } },
    orderBy: { createdAt: 'asc' },
  });
}

// Envoi d'un code OTP : WhatsApp en prioritaire (si activé + numéro connu),
// sinon repli automatique sur l'e-mail. Ne lève que si AUCUN canal n'a marché.
async function dispatchOtp(
  opts: { phone?: string | null; email: string; code: string; kind: 'verify' | 'reset' },
): Promise<'whatsapp' | 'email'> {
  const { phone, email, code, kind } = opts;
  if (phone && whatsappOtpEnabled()) {
    const sent = await sendOtpWhatsApp(phone, code);
    if (sent) return 'whatsapp';
  }
  if (kind === 'verify') {
    await sendVerifyCodeEmail(email, code);
  } else {
    await sendPasswordResetEmail(email, code);
  }
  return 'email';
}

/**
 * Inscription.
 *
 * Anti-énumération : si l'email ou le numéro existe déjà, on renvoie EXACTEMENT
 * la même réponse que pour une inscription réussie, sans rien envoyer. Un
 * attaquant ne peut donc pas découvrir quels emails sont inscrits, et ne peut
 * pas utiliser ce point d'entrée pour spammer un tiers.
 */
export async function register(input: RegisterInput) {
  const genericResponse = {
    requiresVerification: true,
    email: input.email,
  };

  if (env.REGISTRATION_MODE === 'closed') {
    throw serviceUnavailable('Les inscriptions sont temporairement fermées.');
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return genericResponse;
  }

  // Un même numéro ne doit pas créer un second compte.
  const suffix = phoneSuffix(input.phone);
  if (suffix) {
    const byPhone = await prisma.user.findFirst({
      where: { phone: { contains: suffix } },
      select: { id: true },
    });
    if (byPhone) {
      return genericResponse;
    }
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
    await dispatchOtp({ phone: input.phone, email: input.email, code, kind: 'verify' });
  } catch {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => undefined);
    throw badRequest("Impossible d'envoyer le code de vérification");
  }

  return {
    ...genericResponse,
    devCode: env.NODE_ENV === 'production' ? undefined : code,
  };
}

export async function login(input: LoginInput, meta?: SessionMeta) {
  const raw = (input.identifier || input.email || '').trim();
  const user = await findUserByEmailOrPhone(raw);
  if (!user) {
    // bcrypt factice : le temps de réponse ne révèle pas l'existence du compte.
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw unauthorized('Email, numéro ou mot de passe incorrect');
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw unauthorized('Email, numéro ou mot de passe incorrect');
  }

  if (!user.isActive) {
    // Message identique à un échec d'identifiants : pas d'oracle sur le statut.
    await bcrypt.compare(input.password, DUMMY_HASH);
    throw unauthorized('Email, numéro ou mot de passe incorrect');
  }

  if (!user.emailVerified) {
    return { requiresVerification: true, email: user.email };
  }

  const safeUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: SAFE_USER_SELECT,
  });

  if (!safeUser || !safeUser.isActive) {
    throw unauthorized('Email, numéro ou mot de passe incorrect');
  }

  const refreshToken = await createSession(user, meta);
  return { token: signToken(user), refreshToken, user: safeUser };
}

export async function verifyEmail(input: VerifyEmailInput, meta?: SessionMeta) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const genericFailure = unauthorized('Code invalide ou expiré');

  if (!user || !user.emailVerifyCode) {
    throw genericFailure;
  }

  if (user.emailVerifyExpiresAt && user.emailVerifyExpiresAt.getTime() < Date.now()) {
    throw genericFailure;
  }

  if (!codeEquals(user.emailVerifyCode, input.code)) {
    throw genericFailure;
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
      // `expiresAt` n'est volontairement PAS repoussé : une session garde une
      // durée de vie absolue depuis sa création, ce qui empêche d'entretenir
      // indéfiniment une session volée en appelant /refresh en boucle.
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

/** Message unique, identique que l'e-mail existe ou non (anti-énumération). */
const RESET_GENERIC_MESSAGE =
  'Si un compte existe pour cette adresse, un code vient d\'être envoyé.';

export async function requestPasswordReset(input: ForgotPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.isActive || !user.emailVerified) {
    return { message: RESET_GENERIC_MESSAGE };
  }

  if (user.passwordResetSentAt && user.passwordResetSentAt.getTime() > Date.now() - RESEND_COOLDOWN_MS) {
    // Le cooldown ne doit pas non plus révéler l'existence du compte : on
    // renvoie le même message générique au lieu d'un 429.
    return { message: RESET_GENERIC_MESSAGE };
  }

  const code = generateCode();
  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetCode: code,
      passwordResetSentAt: now,
      passwordResetExpiresAt: new Date(now.getTime() + CODE_TTL_MS),
    },
  });

  try {
    await dispatchOtp({ phone: user.phone, email: user.email, code, kind: 'reset' });
  } catch {
    throw badRequest("Impossible d'envoyer le code de réinitialisation");
  }

  return { message: RESET_GENERIC_MESSAGE };
}

export async function resetPassword(input: ResetPasswordInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const genericFailure = unauthorized('Code invalide ou expiré');

  if (!user || !user.passwordResetCode) {
    throw genericFailure;
  }

  if (user.passwordResetExpiresAt && user.passwordResetExpiresAt.getTime() < Date.now()) {
    throw genericFailure;
  }

  if (!codeEquals(user.passwordResetCode, input.code)) {
    throw genericFailure;
  }

  const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetCode: null,
      passwordResetSentAt: null,
      passwordResetExpiresAt: null,
    },
  });

  await prisma.session.updateMany({
    where: { userId: user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  return { message: 'Mot de passe réinitialisé. Vous pouvez vous connecter.' };
}

export async function resendCode(email: string) {
  // Message unique : ni l'existence du compte, ni le statut de vérification ne
  // doivent être exposés (sinon énumération d'emails et de comptes vérifiés).
  const genericMessage = 'Si un compte existe pour cette adresse, un nouveau code a été envoyé.';

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { message: genericMessage };
  }

  if (user.emailVerified) {
    return { message: genericMessage };
  }

  if (user.emailVerifySentAt && user.emailVerifySentAt.getTime() > Date.now() - RESEND_COOLDOWN_MS) {
    return { message: genericMessage };
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
    await dispatchOtp({ phone: user.phone, email, code, kind: 'verify' });
  } catch {
    throw badRequest("Impossible d'envoyer le code de vérification");
  }

  return { message: genericMessage };
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