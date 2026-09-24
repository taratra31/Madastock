import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app';

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

  it('register : refuse un email déjà utilisé', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser);

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@madastock.mg',
      password: 'password123',
      fullName: 'Test User',
    });

    expect(res.status).toBe(409);
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

  it('resend-code : renvoie un message pour un compte non vérifié', async () => {
    prismaMock.user.findUnique.mockResolvedValue(pendingUser);
    prismaMock.user.update.mockResolvedValue({ ...pendingUser, emailVerifyCode: '654321' });

    const res = await request(app).post('/api/v1/auth/resend-code').send({
      email: 'test@madastock.mg',
    });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Un nouveau code a été envoyé.');
  });

  it('resend-code : rate-limit (429) si demandé trop tôt', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...pendingUser,
      emailVerifySentAt: new Date(),
    });

    const res = await request(app).post('/api/v1/auth/resend-code').send({
      email: 'test@madastock.mg',
    });

    expect(res.status).toBe(429);
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
});