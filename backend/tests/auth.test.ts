import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app';
import { registerSchema } from '../src/validators/auth.validator';

const baseUser = {
  id: 'user-1',
  email: 'test@madastock.mg',
  passwordHash: bcrypt.hashSync('password123', 4),
  fullName: 'Test User',
  phone: '+261340000000',
  avatarUrl: null,
  isSuperAdmin: false,
  emailVerified: false,
  isActive: true,
  emailVerifyCode: null,
  emailVerifySentAt: null,
  emailVerifyExpiresAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  memberships: [],
};

const verifiedUser = {
  ...baseUser,
  emailVerified: true,
};

const pendingUser = {
  ...baseUser,
  emailVerifyCode: '123456',
  emailVerifySentAt: new Date('2026-09-23T00:00:00.000Z'),
  emailVerifyExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
};

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  session: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

vi.mock('../src/lib/prisma', () => ({
  default: prismaMock,
}));

describe('Validation du numéro d’inscription', () => {
  it.each(['32', '33', '34', '35', '37', '38'])('accepte le préfixe %s', (prefix) => {
    const result = registerSchema.safeParse({
      email: 'test@madastock.mg',
      password: 'password123',
      fullName: 'Test User',
      phone: `+261${prefix}1234567`,
    });

    expect(result.success).toBe(true);
  });

  it.each([
    '+261391234567',
    '+261201234567',
    '+26134123456',
    '+2613412345678',
    '341234567',
    '+33123456789',
  ])('refuse le numéro %s', (phone) => {
    const result = registerSchema.safeParse({
      email: 'test@madastock.mg',
      password: 'password123',
      fullName: 'Test User',
      phone,
    });

    expect(result.success).toBe(false);
  });

  it('accepte un numéro vide', () => {
    const result = registerSchema.safeParse({
      email: 'test@madastock.mg',
      password: 'password123',
      fullName: 'Test User',
      phone: '',
    });

    expect(result.success).toBe(true);
  });
});

describe('Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register : crée un compte et demande la vérification e-mail (devCode en non-prod)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(baseUser);

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@madastock.mg',
      password: 'password123',
      fullName: 'Test User',
    });

    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.email).toBe('test@madastock.mg');
    expect(res.body.devCode).toMatch(/^\d{6}$/);
    expect(res.body).not.toHaveProperty('token');
  });

  it('register : ne révèle pas si un email est déjà utilisé (anti-énumération)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser);

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@madastock.mg',
      password: 'password123',
      fullName: 'Test User',
    });

    // Réponse identique à une inscription réussie : impossible de découvrir
    // quels emails sont inscrits, et aucun code n'est envoyé au détenteur.
    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.email).toBe('test@madastock.mg');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('register : valide les données (password court)', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@madastock.mg',
      password: 'short',
      fullName: 'Test User',
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('details');
  });

  it('register : refuse un numéro malgache non autorisé', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@madastock.mg',
      password: 'password123',
      fullName: 'Test User',
      phone: '+261391234567',
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('details');
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('verify-email : connecte avec un code valide', async () => {
    prismaMock.user.findUnique.mockResolvedValue(pendingUser);
    prismaMock.user.update.mockResolvedValue({ ...pendingUser, emailVerified: true });

    const res = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'test@madastock.mg',
      code: '123456',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.fullName).toBe('Test User');
  });

  it('verify-email : refuse un code incorrect', async () => {
    prismaMock.user.findUnique.mockResolvedValue(pendingUser);

    const res = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'test@madastock.mg',
      code: '000000',
    });

    expect(res.status).toBe(401);
  });

  it('verify-email : valide le format du code (6 chiffres)', async () => {
    const res = await request(app).post('/api/v1/auth/verify-email').send({
      email: 'test@madastock.mg',
      code: '12345',
    });

    expect(res.status).toBe(400);
  });

  it('login : renvoie token + user pour un compte vérifié', async () => {
    prismaMock.user.findUnique.mockResolvedValue(verifiedUser);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@madastock.mg',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.fullName).toBe('Test User');
  });

  it("login : demande la vérification si le compte n'est pas vérifié", async () => {
    prismaMock.user.findUnique.mockResolvedValue(pendingUser);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@madastock.mg',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body.requiresVerification).toBe(true);
    expect(res.body.email).toBe('test@madastock.mg');
    expect(res.body).not.toHaveProperty('token');
  });

  it('login : refuse un mauvais mot de passe', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@madastock.mg',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });

  it('login : accepte un numéro de téléphone (champ unique)', async () => {
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser);
    prismaMock.user.findUnique.mockResolvedValue(verifiedUser);

    const res = await request(app).post('/api/v1/auth/login').send({
      identifier: '034 00 000 00',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    // Format local et format international retombent sur la même recherche.
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: { contains: '340000000' } },
      }),
    );
  });

  it('login : numéro au format international accepté aussi', async () => {
    prismaMock.user.findFirst.mockResolvedValue(verifiedUser);
    prismaMock.user.findUnique.mockResolvedValue(verifiedUser);

    const res = await request(app).post('/api/v1/auth/login').send({
      identifier: '+261 34 00 00 00 0',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { phone: { contains: '340000000' } },
      }),
    );
  });

  it('login : refuse un identifiant vide', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({
      password: 'password123',
    });

    expect(res.status).toBe(400);
  });

  it('register : ne crée pas de doublon de numéro (réponse générique)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-1' });

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'autre@madastock.mg',
      password: 'password123',
      fullName: 'Autre Utilisateur',
      phone: '+261340000000',
    });

    // Pas de 409 « ce numéro existe » : ce message permettait d'énumérer les
    // numéros enregistrés.
    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(prismaMock.user.create).not.toHaveBeenCalled();
  });

  it('resend-code : renvoie un message générique pour un compte non vérifié', async () => {
    prismaMock.user.findUnique.mockResolvedValue(pendingUser);
    prismaMock.user.update.mockResolvedValue({ ...pendingUser, emailVerifyCode: '654321' });

    const res = await request(app).post('/api/v1/auth/resend-code').send({
      email: 'test@madastock.mg',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/un nouveau code/i);
  });

  it('resend-code : cooldown ne renvoie PAS de 429 (anti-énumération)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...pendingUser,
      emailVerifySentAt: new Date(),
    });

    const res = await request(app).post('/api/v1/auth/resend-code').send({
      email: 'test@madastock.mg',
    });

    // Un 429 ici révélait que le compte existe ET qu'un code vient d'arriver.
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/un nouveau code/i);
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('/me : nécessite un token valide', async () => {
    prismaMock.user.findUnique.mockResolvedValue(verifiedUser);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      email: 'test@madastock.mg',
      password: 'password123',
    });
    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe('test@madastock.mg');
  });

  it('/me : renvoie 401 sans token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('forgot-password : envoie un code pour un compte vérifié', async () => {
    prismaMock.user.findUnique.mockResolvedValue(verifiedUser);
    prismaMock.user.update.mockResolvedValue({ ...verifiedUser, passwordResetCode: '123456' });

    const res = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'test@madastock.mg',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/un code vient d/i);
  });

  it('forgot-password : ne révèle pas l’existence du compte (retour générique)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    const res = await request(app).post('/api/v1/auth/forgot-password').send({
      email: 'inconnu@madastock.mg',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/si un compte existe/i);
  });

  it('reset-password : réinitialise avec un code valide', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...verifiedUser,
      passwordResetCode: '123456',
      passwordResetExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    prismaMock.user.update.mockResolvedValue({ ...verifiedUser, passwordResetCode: null });
    prismaMock.session.updateMany.mockResolvedValue({ count: 1 });

    const res = await request(app).post('/api/v1/auth/reset-password').send({
      email: 'test@madastock.mg',
      code: '123456',
      newPassword: 'nouveaupass',
    });

    expect(res.status).toBe(200);
    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: expect.any(String), passwordResetCode: null }),
      }),
    );
    expect(prismaMock.session.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ revokedAt: null }) }),
    );
  });

  it('reset-password : refuse un code incorrect', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...verifiedUser,
      passwordResetCode: '123456',
      passwordResetExpiresAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    const res = await request(app).post('/api/v1/auth/reset-password').send({
      email: 'test@madastock.mg',
      code: '000000',
      newPassword: 'nouveaupass',
    });

    expect(res.status).toBe(401);
  });
});

describe('Durcissement du jeton et du compte', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('un refresh token ne donne PAS accès à l\'API (pas de confusion de type)', async () => {
    // Le refresh token est signé par le même secret que l'access token : sans
    // claim de type, un refresh token volé == 30 jours d'accès complet.
    const jwt = (await import('jsonwebtoken')).default;
    const { env } = await import('../src/config/env');

    const refreshToken = jwt.sign(
      { sub: 'user-1', email: 'test@madastock.mg', jti: 'session-1', typ: 'refresh' },
      env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '30d' },
    );

    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@madastock.mg',
      isActive: true,
      deletedAt: null,
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalide|expir/i);
  });

  it('un compte désactivé perd l\'accès même avec un access token valide', async () => {
    prismaMock.user.findUnique.mockResolvedValue(verifiedUser);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: 'test@madastock.mg',
      password: 'password123',
    });
    expect(loginRes.status).toBe(200);

    // Le compte est désactivé APRÈS l'émission du jeton.
    prismaMock.user.findUnique.mockResolvedValue({
      ...verifiedUser,
      isActive: false,
      deletedAt: null,
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(401);
  });

  it('un compte supprimé (deletedAt) est rejeté', async () => {
    prismaMock.user.findUnique.mockResolvedValue(verifiedUser);

    const loginRes = await request(app).post('/api/v1/auth/login').send({
      identifier: 'test@madastock.mg',
      password: 'password123',
    });

    prismaMock.user.findUnique.mockResolvedValue({
      ...verifiedUser,
      isActive: true,
      deletedAt: new Date(),
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(401);
  });

  it('un jeton signé avec un autre algorithme est refusé', async () => {
    const jwt = (await import('jsonwebtoken')).default;
    const forged = jwt.sign({ sub: 'user-1', email: 'test@madastock.mg' }, 'un-autre-secret', {
      algorithm: 'HS384',
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('REGISTRATION_MODE=closed ferme les inscriptions', async () => {
    const { env } = await import('../src/config/env');
    const previous = env.REGISTRATION_MODE;
    (env as { REGISTRATION_MODE: string }).REGISTRATION_MODE = 'closed';

    try {
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app).post('/api/v1/auth/register').send({
        email: 'nouveau@madastock.mg',
        password: 'password123',
        fullName: 'Nouveau Client',
      });

      expect(res.status).toBe(503);
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    } finally {
      (env as { REGISTRATION_MODE: string }).REGISTRATION_MODE = previous;
    }
  });
});

describe('Bootstrap superadmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ne crée AUCUN compte avec des identifiants par défaut', async () => {
    const { ensureSuperAdmin } = await import('../src/bootstrap/superadmin');
    const { env } = await import('../src/config/env');

    const previousEmail = env.SUPERADMIN_EMAIL;
    const previousPassword = env.SUPERADMIN_PASSWORD;
    delete (env as { SUPERADMIN_EMAIL?: string }).SUPERADMIN_EMAIL;
    delete (env as { SUPERADMIN_PASSWORD?: string }).SUPERADMIN_PASSWORD;

    try {
      await ensureSuperAdmin();

      // Régression : avant, un compte admin@madastock.mg / admin123 était créé
      // à chaque démarrage quand les variables d'environnement manquaient.
      expect(prismaMock.user.create).not.toHaveBeenCalled();
      expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
    } finally {
      (env as { SUPERADMIN_EMAIL?: string }).SUPERADMIN_EMAIL = previousEmail;
      (env as { SUPERADMIN_PASSWORD?: string }).SUPERADMIN_PASSWORD = previousPassword;
    }
  });

  it('ne réécrit jamais le mot de passe d\'un superadmin existant', async () => {
    const { ensureSuperAdmin } = await import('../src/bootstrap/superadmin');
    const { env } = await import('../src/config/env');

    const previousEmail = env.SUPERADMIN_EMAIL;
    const previousPassword = env.SUPERADMIN_PASSWORD;
    (env as { SUPERADMIN_EMAIL?: string }).SUPERADMIN_EMAIL = 'admin@madastock.mg';
    (env as { SUPERADMIN_PASSWORD?: string }).SUPERADMIN_PASSWORD = 'UnMotDePasseTresLong2026!';

    try {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'admin-1',
        email: 'admin@madastock.mg',
        passwordHash: bcrypt.hashSync('MotDePasseChoisiParLEAdmin2026', 4),
        isSuperAdmin: true,
        isActive: true,
        emailVerified: true,
      });

      await ensureSuperAdmin();

      // Un redéploiement ne doit pas pouvoir réinitialiser le mot de passe de
      // l'administrateur (ni son mot de passe choisi, ni le secret d'env).
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    } finally {
      (env as { SUPERADMIN_EMAIL?: string }).SUPERADMIN_EMAIL = previousEmail;
      (env as { SUPERADMIN_PASSWORD?: string }).SUPERADMIN_PASSWORD = previousPassword;
    }
  });
});