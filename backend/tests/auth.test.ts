import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import app from '../src/app';

const mockUser = {
  id: 'user-1',
  email: 'test@madastock.mg',
  passwordHash: bcrypt.hashSync('password123', 4),
  fullName: 'Test User',
  phone: '+261340000000',
  avatarUrl: null,
  isSuperAdmin: false,
  emailVerified: false,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  memberships: [],
};

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../src/lib/prisma', () => ({
  default: prismaMock,
}));

describe('Auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register : crée un compte et renvoie un token', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue(mockUser);

    const res = await request(app).post('/api/v1/auth/register').send({
      email: 'test@madastock.mg',
      password: 'password123',
      fullName: 'Test User',
    });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@madastock.mg');
  });

  it('register : refuse un email déjà utilisé', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

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

  it('login : renvoie token + user pour de bons identifiants', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@madastock.mg',
      password: 'password123',
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.fullName).toBe('Test User');
  });

  it('login : refuse un mauvais mot de passe', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'test@madastock.mg',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });

  it('/me : nécessite un token valide', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);

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