import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';

const mockUser = {
  id: 'user-owner',
  email: 'owner@madastock.mg',
  passwordHash: bcrypt.hashSync('password123', 4),
  fullName: 'Owner User',
  phone: null,
  avatarUrl: null,
  isSuperAdmin: false,
  emailVerified: false,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  memberships: [],
};

const mockStore = {
  id: 'store-1',
  name: 'Boutique Test',
  description: null,
  logoUrl: null,
  address: null,
  city: 'Antananarivo',
  country: 'MG',
  phone: null,
  email: null,
  fiscalNumber: null,
  statNumber: null,
  currency: 'MGA',
  timezone: 'Indian/Antananarivo',
  active: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  _count: { members: 1, products: 0, sales: 0 },
};

const mockOwnerMembership = {
  id: 'membership-1',
  storeId: 'store-1',
  userId: 'user-owner',
  role: 'OWNER' as const,
  isOwner: true,
  canManageAll: true,
  store: { id: 'store-1', active: true },
};

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  plan: { findUnique: vi.fn() },
  store: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  storeMember: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  subscription: { create: vi.fn() },
  warehouse: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({
  default: prismaMock,
}));

async function loginToken() {
  prismaMock.user.findUnique.mockResolvedValue(mockUser);
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'owner@madastock.mg', password: 'password123' });
  return res.body.token as string;
}

describe('Stores', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/stores', () => {
    it('crée une boutique (transaction : store + member OWNER + subscription + warehouse)', async () => {
      prismaMock.plan.findUnique.mockResolvedValue({ id: 'plan-free', name: 'FREE', priceAr: 0, billingCycle: 'MONTHLY' });
      prismaMock.$transaction.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
        const tx = {
          store: { create: vi.fn().mockResolvedValue(mockStore) },
          storeMember: { create: vi.fn().mockResolvedValue({}) },
          subscription: { create: vi.fn().mockResolvedValue({}) },
          warehouse: { create: vi.fn().mockResolvedValue({}) },
        };
        return fn(tx);
      });

      const token = await loginToken();
      const res = await request(app)
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Boutique Test', city: 'Antananarivo' });

      expect(res.status).toBe(201);
      expect(res.body.store.name).toBe('Boutique Test');
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    });

    it('refuse sans authentification', async () => {
      const res = await request(app).post('/api/v1/stores').send({ name: 'Boutique' });
      expect(res.status).toBe(401);
    });

    it('valide le nom obligatoire', async () => {
      const token = await loginToken();
      const res = await request(app)
        .post('/api/v1/stores')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/stores', () => {
    it('liste les boutiques de l\'utilisateur', async () => {
      prismaMock.storeMember.findMany.mockResolvedValue([
        {
          id: 'membership-1',
          role: 'OWNER',
          isOwner: true,
          canManageAll: true,
          store: {
            id: 'store-1',
            name: 'Boutique Test',
            logoUrl: null,
            city: 'Antananarivo',
            country: 'MG',
            currency: 'MGA',
            active: true,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
            subscription: { status: 'TRIALING', plan: { name: 'FREE' } },
          },
        },
      ]);

      const token = await loginToken();
      const res = await request(app)
        .get('/api/v1/stores')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.memberships).toHaveLength(1);
      expect(res.body.memberships[0].store.name).toBe('Boutique Test');
    });
  });

  describe('GET /api/v1/stores/me', () => {
    it('retourne la boutique via X-Store-Id', async () => {
      prismaMock.storeMember.findUnique.mockResolvedValue({
        role: 'OWNER',
        isOwner: true,
        store: { ...mockStore, subscription: null },
      });

      const token = await loginToken();
      const res = await request(app)
        .get('/api/v1/stores/me')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1');

      expect(res.status).toBe(200);
      expect(res.body.store.name).toBe('Boutique Test');
    });

    it('renvoie 403 si X-Store-Id est absent', async () => {
      const token = await loginToken();
      const res = await request(app)
        .get('/api/v1/stores/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('renvoie 403 si l\'utilisateur n\'est pas membre', async () => {
      prismaMock.storeMember.findUnique.mockResolvedValue(null);

      const token = await loginToken();
      const res = await request(app)
        .get('/api/v1/stores/me')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-inexistant');

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/stores/me', () => {
    it('met à jour la boutique (owner)', async () => {
      prismaMock.storeMember.findUnique.mockResolvedValue(mockOwnerMembership);
      prismaMock.store.update.mockResolvedValue({ ...mockStore, name: 'Boutique Renommée' });

      const token = await loginToken();
      const res = await request(app)
        .put('/api/v1/stores/me')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1')
        .send({ name: 'Boutique Renommée' });

      expect(res.status).toBe(200);
      expect(res.body.store.name).toBe('Boutique Renommée');
    });

    it('refuse un rôle CASHIER (pas owner/admin)', async () => {
      prismaMock.storeMember.findUnique.mockResolvedValue({
        ...mockOwnerMembership,
        role: 'CASHIER',
        isOwner: false,
        canManageAll: false,
      });

      const token = await loginToken();
      const res = await request(app)
        .put('/api/v1/stores/me')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1')
        .send({ name: 'Hack' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/stores/me', () => {
    it('désactive la boutique (owner uniquement)', async () => {
      prismaMock.storeMember.findUnique.mockResolvedValue(mockOwnerMembership);
      prismaMock.store.update.mockResolvedValue({ ...mockStore, active: false });

      const token = await loginToken();
      const res = await request(app)
        .delete('/api/v1/stores/me')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1');

      expect(res.status).toBe(204);
    });

    it('refuse la suppression pour un non-owner', async () => {
      prismaMock.storeMember.findUnique.mockResolvedValue({
        ...mockOwnerMembership,
        role: 'ADMIN',
        isOwner: false,
        canManageAll: true,
      });

      const token = await loginToken();
      const res = await request(app)
        .delete('/api/v1/stores/me')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1');

      expect(res.status).toBe(403);
    });
  });

  describe('Membres', () => {
    it('liste les membres', async () => {
      prismaMock.storeMember.findUnique.mockResolvedValue(mockOwnerMembership);
      prismaMock.storeMember.findMany.mockResolvedValue([
        {
          id: 'membership-1',
          role: 'OWNER',
          isOwner: true,
          canManageAll: true,
          createdAt: new Date(),
          user: { id: 'user-1', email: 'owner@madastock.mg', fullName: 'Owner', phone: null, avatarUrl: null },
        },
      ]);

      const token = await loginToken();
      const res = await request(app)
        .get('/api/v1/stores/members')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1');

      expect(res.status).toBe(200);
      expect(res.body.members).toHaveLength(1);
    });

    it('ajoute un membre', async () => {
      prismaMock.storeMember.findUnique
        .mockResolvedValueOnce(mockOwnerMembership)
        .mockResolvedValueOnce(mockOwnerMembership)
        .mockResolvedValueOnce(null);

      const token = await loginToken();

      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'member@madastock.mg' });
      prismaMock.storeMember.create.mockResolvedValue({
        id: 'membership-3',
        role: 'MANAGER',
        isOwner: false,
        canManageAll: false,
        user: { id: 'user-2', email: 'member@madastock.mg', fullName: 'Member', phone: null },
      });

      const res = await request(app)
        .post('/api/v1/stores/members')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1')
        .send({ email: 'member@madastock.mg', role: 'MANAGER' });

      expect(res.status).toBe(201);
      expect(res.body.member.role).toBe('MANAGER');
    });

    it('refuse un membre déjà existant (409)', async () => {
      prismaMock.storeMember.findUnique
        .mockResolvedValueOnce(mockOwnerMembership)
        .mockResolvedValueOnce(mockOwnerMembership)
        .mockResolvedValueOnce({ id: 'membership-99', storeId: 'store-1', userId: 'user-2', role: 'MANAGER' });

      const token = await loginToken();

      prismaMock.user.findUnique.mockResolvedValue({ id: 'user-2', email: 'member@madastock.mg' });

      const res = await request(app)
        .post('/api/v1/stores/members')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1')
        .send({ email: 'member@madastock.mg' });

      expect(res.status).toBe(409);
    });

    it('email inconnu → 404', async () => {
      prismaMock.storeMember.findUnique.mockResolvedValue(mockOwnerMembership);

      const token = await loginToken();

      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/stores/members')
        .set('Authorization', `Bearer ${token}`)
        .set('X-Store-Id', 'store-1')
        .send({ email: 'inconnu@madastock.mg' });

      expect(res.status).toBe(404);
    });
  });
});
