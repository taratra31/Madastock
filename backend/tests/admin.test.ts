import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';

const mockAdmin = {
  id: 'user-admin',
  email: 'admin@madastock.mg',
  passwordHash: bcrypt.hashSync('password123', 4),
  fullName: 'Super Admin',
  phone: null,
  avatarUrl: null,
  isSuperAdmin: true,
  emailVerified: true,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  deletedAt: null,
  memberships: [],
};

const mockRegularUser = {
  ...mockAdmin,
  id: 'user-1',
  email: 'user@madastock.mg',
  fullName: 'User',
  isSuperAdmin: false,
};

const prismaMock = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  session: {
    create: vi.fn().mockResolvedValue({}),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  store: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  subscription: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  payment: {
    count: vi.fn(),
    findMany: vi.fn(),
    groupBy: vi.fn(),
    aggregate: vi.fn(),
  },
  plan: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({
  default: prismaMock,
}));

async function loginAs(user: Record<string, unknown>) {
  prismaMock.user.findUnique.mockResolvedValue(user);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: user.email, password: 'password123' });
  return res.body.token as string;
}

describe('Admin (superadmin)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Protection', () => {
    it('refuse sans authentification (401)', async () => {
      const res = await request(app).get('/api/v1/admin/overview');
      expect(res.status).toBe(401);
    });

    it('refuse un utilisateur non superadmin (403)', async () => {
      const token = await loginAs(mockRegularUser);
      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/admin/overview', () => {
    it('renvoie les statistiques globales', async () => {
      const token = await loginAs(mockAdmin);

      prismaMock.store.count.mockResolvedValue(5);
      prismaMock.user.count.mockResolvedValue(8);
      prismaMock.subscription.groupBy.mockResolvedValue([
        { status: 'ACTIVE', _count: { _all: 2 } },
        { status: 'TRIALING', _count: { _all: 3 } },
      ]);
      prismaMock.payment.groupBy.mockResolvedValue([
        { status: 'SUCCESS', _count: { _all: 1 } },
        { status: 'PENDING', _count: { _all: 2 } },
      ]);
      prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountAr: 150000 } });
      prismaMock.subscription.aggregate.mockResolvedValue({ _sum: { priceAr: 80000 } });
      prismaMock.store.findMany.mockResolvedValue([]);
      prismaMock.user.findMany.mockResolvedValue([]);
      prismaMock.payment.findMany.mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/admin/overview')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.stores).toEqual({ total: 5, active: 5, inactive: 0 });
      expect(res.body.subscriptions.active).toBe(2);
      expect(res.body.subscriptions.mrrAr).toBe(80000);
      expect(res.body.payments.totalRevenueAr).toBe(150000);
    });
  });

  describe('Stores', () => {
    it('liste les boutiques (paginées)', async () => {
      const token = await loginAs(mockAdmin);
      prismaMock.store.count.mockResolvedValue(1);
      prismaMock.store.findMany.mockResolvedValue([
        {
          id: 'store-1',
          name: 'Boutique Test',
          sector: 'BOUTIQUE',
          city: 'Antananarivo',
          country: 'MG',
          currency: 'MGA',
          active: true,
          createdAt: new Date(),
          _count: { members: 1, products: 10, sales: 5 },
          subscription: { status: 'ACTIVE', priceAr: 30000, currentPeriodEnd: new Date(), plan: { name: 'STARTER' } },
          members: [{ user: { fullName: 'Owner', email: 'owner@madastock.mg' } }],
        },
      ]);

      const res = await request(app)
        .get('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].name).toBe('Boutique Test');
      expect(res.body.total).toBe(1);
    });

    it('active/désactive une boutique', async () => {
      const token = await loginAs(mockAdmin);
      prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1', deletedAt: null });
      prismaMock.store.update.mockResolvedValue({ id: 'store-1', name: 'Boutique Test', active: false });

      const res = await request(app)
        .patch('/api/v1/admin/stores/store-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ active: false });

      expect(res.status).toBe(200);
      expect(res.body.active).toBe(false);
      expect(prismaMock.store.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { active: false } })
      );
    });
  });

  describe('Users', () => {
    it('liste les utilisateurs', async () => {
      const token = await loginAs(mockAdmin);
      prismaMock.user.count.mockResolvedValue(1);
      prismaMock.user.findMany.mockResolvedValue([
        {
          id: 'user-1',
          email: 'user@madastock.mg',
          fullName: 'User',
          phone: null,
          isActive: true,
          isSuperAdmin: false,
          emailVerified: true,
          createdAt: new Date(),
          memberships: [{ role: 'OWNER', isOwner: true, store: { id: 'store-1', name: 'Boutique Test', active: true } }],
        },
      ]);

      const res = await request(app)
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });

    it('refuse la désactivation de son propre compte (400)', async () => {
      const token = await loginAs(mockAdmin);
      prismaMock.user.findUnique.mockResolvedValue(mockAdmin);

      const res = await request(app)
        .patch('/api/v1/admin/users/user-admin')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(400);
    });

    it('désactive un utilisateur normal', async () => {
      const token = await loginAs(mockAdmin);
      prismaMock.user.findUnique
        .mockReset()
        .mockResolvedValueOnce(mockAdmin)
        .mockResolvedValueOnce(mockRegularUser);
      prismaMock.user.update.mockResolvedValue({ ...mockRegularUser, isActive: false });

      const res = await request(app)
        .patch('/api/v1/admin/users/user-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ isActive: false });

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
    });
  });

  describe('Subscriptions', () => {
    it('liste les abonnements', async () => {
      const token = await loginAs(mockAdmin);
      prismaMock.subscription.count.mockResolvedValue(1);
      prismaMock.subscription.findMany.mockResolvedValue([
        {
          id: 'sub-1',
          status: 'ACTIVE',
          priceAr: 30000,
          billingCycle: 'MONTHLY',
          autoRenew: true,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(),
          trialEndsAt: null,
          cancelledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          store: { id: 'store-1', name: 'Boutique Test', active: true },
          plan: { id: 'plan-starter', name: 'STARTER', priceAr: 30000 },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/admin/subscriptions')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });

    it('change le plan d\'un abonnement', async () => {
      const token = await loginAs(mockAdmin);
      prismaMock.subscription.findUnique.mockResolvedValue({
        id: 'sub-1',
        planId: 'plan-starter',
        status: 'ACTIVE',
      });
      prismaMock.plan.findUnique.mockResolvedValue({
        id: 'plan-pro',
        name: 'PRO',
        priceAr: 80000,
        billingCycle: 'MONTHLY',
        isActive: true,
      });
      prismaMock.subscription.update.mockResolvedValue({
        id: 'sub-1',
        status: 'ACTIVE',
        plan: { id: 'plan-pro', name: 'PRO' },
      });

      const res = await request(app)
        .patch('/api/v1/admin/subscriptions/sub-1')
        .set('Authorization', `Bearer ${token}`)
        .send({ planId: 'plan-pro' });

      expect(res.status).toBe(200);
      expect(res.body.plan.name).toBe('PRO');
    });
  });

  describe('Payments', () => {
    it('liste les paiements', async () => {
      const token = await loginAs(mockAdmin);
      prismaMock.payment.count.mockResolvedValue(1);
      prismaMock.payment.findMany.mockResolvedValue([
        {
          id: 'pay-1',
          amountAr: 30000,
          status: 'SUCCESS',
          provider: 'ARIARI',
          currency: 'MGA',
          merchantReference: 'SUB-abc-123',
          providerReference: 'ari-1',
          paidAt: new Date(),
          failedAt: null,
          createdAt: new Date(),
          store: { id: 'store-1', name: 'Boutique Test' },
          plan: { id: 'plan-starter', name: 'STARTER' },
        },
      ]);

      const res = await request(app)
        .get('/api/v1/admin/payments')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].status).toBe('SUCCESS');
    });
  });
});