import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import { parsePeriod, periodDayCount, rotationReport } from '../src/services/report.service';

const mockUser = {
  id: 'user-1',
  email: 'staff@madastock.mg',
  passwordHash: bcrypt.hashSync('password123', 4),
  fullName: 'Staff User',
  phone: null,
  avatarUrl: null,
  isSuperAdmin: false,
  emailVerified: true,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  memberships: [],
};

const prismaMock = vi.hoisted(() => {
  const self: Record<string, unknown> = {
    user: { findUnique: vi.fn() },
    session: {
      create: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    storeMember: { findUnique: vi.fn(), findMany: vi.fn() },
    store: { findUnique: vi.fn(), findMany: vi.fn() },
    subscription: { findUnique: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), upsert: vi.fn() },
    plan: { findUnique: vi.fn(), findMany: vi.fn() },
    payment: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
    notification: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), delete: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), createMany: vi.fn() },
    stock: { findMany: vi.fn() },
    stockMovement: { findMany: vi.fn(), count: vi.fn() },
    sale: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn() },
    saleItem: { groupBy: vi.fn() },
    expense: { findMany: vi.fn() },
  };
  self.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(self));
  return self as never;
});

vi.mock('../src/lib/prisma', () => ({ default: prismaMock }));

const subscription = {
  id: 'sub-1',
  storeId: 'store-1',
  planId: 'plan-pro',
  status: 'ACTIVE',
  currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
  priceAr: 120000,
  billingCycle: 'MONTHLY',
  autoRenew: true,
  cancelledAt: null,
  plan: {
    id: 'plan-pro',
    name: 'PRO',
    priceAr: 120000,
    durationDays: 30,
    durationMonths: 1,
    billingCycle: 'MONTHLY',
    isActive: true,
    featuresJson: '{}',
  },
  store: { billingExempt: false },
};

const product = {
  id: 'p1',
  name: 'Riz 1kg',
  sku: 'RIZ1',
  unit: 'kg',
  trackStock: true,
  costPriceAr: 2500,
  sellingPriceAr: 3500,
  lowStockThreshold: 5,
};

async function loginAs(role: string) {
  prismaMock.user.findUnique.mockResolvedValue(mockUser);
  prismaMock.storeMember.findUnique.mockResolvedValue({
    role,
    isOwner: false,
    canManageAll: false,
    store: { id: 'store-1', active: true },
  });
  prismaMock.subscription.findUnique.mockResolvedValue(subscription);
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1', billingExempt: false, name: 'Boutique Test' });

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'staff@madastock.mg', password: 'password123' });
  const token = res.body.token as string;
  return (url: string) => request(app).get(url).set({ Authorization: `Bearer ${token}`, 'X-Store-Id': 'store-1' });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.sale.findMany.mockResolvedValue([]);
  prismaMock.sale.count.mockResolvedValue(0);
  prismaMock.sale.aggregate.mockResolvedValue({ _sum: { totalAr: 0 }, _count: 0 });
  prismaMock.expense.findMany.mockResolvedValue([]);
  prismaMock.saleItem.groupBy.mockResolvedValue([]);
  prismaMock.stock.findMany.mockResolvedValue([]);
});

describe('Période de rapport', () => {
  it('vaut 30 jours par défaut et inclut toute la journée de fin', () => {
    const period = parsePeriod();
    expect(period.from.getHours()).toBe(0);
    expect(period.to.getHours()).toBe(23);
    expect(periodDayCount(period)).toBe(30);
  });

  it('compte les jours calendaires, bornes incluses, sans dépendre de l’heure', () => {
    expect(periodDayCount(parsePeriod('2026-09-01', '2026-09-30'))).toBe(30);
    expect(periodDayCount(parsePeriod('2026-02-01', '2026-02-01'))).toBe(1);
    expect(periodDayCount(parsePeriod('2026-12-01', '2027-01-01'))).toBe(32);
  });

  it('refuse une période inversée', () => {
    expect(() => parsePeriod('2026-09-30', '2026-09-01')).toThrow(/précéder/);
  });
});

describe('Rapport de rotation', () => {
  it('calcule le ratio de rotation et repère le stock dormant', async () => {
    prismaMock.stock.findMany.mockResolvedValue([
      { productId: 'p1', quantityAr: 100, reservedQty: 0, product },
      { productId: 'p2', quantityAr: 20, reservedQty: 0, product: { ...product, id: 'p2', name: 'Huile', costPriceAr: 5000, sellingPriceAr: 6000 } },
    ]);
    prismaMock.saleItem.groupBy.mockResolvedValue([
      { productId: 'p1', _sum: { quantityAr: 300, costPriceAr: 2500 } },
    ]);

    const api = await loginAs('MANAGER');
    const res = await api('/api/v1/reports/rotation?from=2026-09-01&to=2026-09-30');

    expect(res.status).toBe(200);
    expect(res.body.totals.periodDays).toBe(30);
    // Riz : 100 unités × 2500 = 250 000 immobilisés, 300 × 2500 = 750 000 sortis.
    // Rotation du produit = 750 000 / 250 000 = 3 sur le mois.
    expect(res.body.topRotation[0].turnoverRatio).toBe(3);
    // Couverture : 300 vendus / 30 j = 10 par jour → 100 / 10 = 10 jours.
    expect(res.body.topRotation[0].daysOfStock).toBe(10);
    // Rotation globale = 750 000 / 350 000 × (30/30) = 2.14
    expect(res.body.totals.rotationRatio).toBe(2.14);
    expect(res.body.deadStock.map((p: any) => p.name)).toEqual(['Huile']);
    expect(res.body.totals.deadStockCount).toBe(1);
    expect(res.body.totals.stockValue).toBe(350000); // 250 000 + 100 000
    expect(res.body.includesCosts).toBe(true);
  });

  it('un rapport sans cost.view masque tous les montants de coût (service)', async () => {
    prismaMock.stock.findMany.mockResolvedValue([
      { productId: 'p1', quantityAr: 100, reservedQty: 0, product },
    ]);
    prismaMock.saleItem.groupBy.mockResolvedValue([
      { productId: 'p1', _sum: { quantityAr: 300, costPriceAr: 2500 } },
    ]);

    const report = await rotationReport('store-1', parsePeriod('2026-09-01', '2026-09-30'), {
      includeCosts: false,
    });

    expect(report.includesCosts).toBe(false);
    expect(report.totals.stockValue).toBeNull();
    expect(report.totals.rotationRatio).toBeNull();
    expect(report.totals.deadStockValue).toBeNull();
    expect(report.topRotation[0].stockValue).toBeNull();
    expect(report.topRotation[0].turnoverRatio).toBeNull();
    // Les données d'exploitation restent visibles
    expect(report.topRotation[0].quantity).toBe(100);
    expect(report.topRotation[0].soldQty).toBe(300);
    expect(report.topRotation[0].daysOfStock).toBe(10);
    expect(report.totals.soldRevenue).toBe(1050000);
  });

  it('le caissier est refusé sur les rapports (matrice RBAC)', async () => {
    const api = await loginAs('CASHIER');
    const res = await api('/api/v1/reports/rotation');
    expect(res.status).toBe(403);
  });
});
