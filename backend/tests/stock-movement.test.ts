import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';

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

const prismaMock = vi.hoisted(() => ({
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
  notification: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  stockMovement: { findMany: vi.fn(), count: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({ default: prismaMock }));

const subscription = {
  id: 'sub-1',
  storeId: 'store-1',
  planId: 'plan-pro',
  status: 'ACTIVE',
  trialEndsAt: null,
  currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
  currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
  priceAr: 120000,
  billingCycle: 'MONTHLY',
  autoRenew: true,
  cancelledAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
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

const movement = {
  id: 'mv-1',
  storeId: 'store-1',
  warehouseId: 'wh-1',
  productId: 'p1',
  variantId: null,
  movementType: 'SALE',
  quantity: 3,
  unitCostAr: null,
  reason: 'Vente comptoir',
  referenceId: 'sale-1',
  referenceType: 'SALE',
  createdById: 'user-1',
  createdAt: new Date('2026-09-20T08:30:00.000Z'),
  warehouse: { id: 'wh-1', name: 'Dépôt principal' },
  product: { id: 'p1', name: 'Riz 1kg', sku: 'RIZ1', unit: 'kg' },
  variant: null,
  createdBy: { id: 'user-1', fullName: 'Staff User' },
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
  prismaMock.stockMovement.findMany.mockResolvedValue([movement]);
  prismaMock.stockMovement.count.mockResolvedValue(1);
});

describe('Historique des mouvements de stock', () => {
  it('renvoie les mouvements avec le nom du produit, de l’entrepôt et de l’auteur', async () => {
    const api = await loginAs('STOCK_MANAGER');
    const res = await api('/api/v1/stock/movements');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.page).toBe(1);
    const row = res.body.items[0];
    expect(row.productName).toBe('Riz 1kg');
    expect(row.warehouseName).toBe('Dépôt principal');
    expect(row.createdByName).toBe('Staff User');
    expect(row.quantity).toBe(3);
    expect(row.movementType).toBe('SALE');
  });

  it('filtre par entrepôt, type et période, et ne renvoie que la boutique courante', async () => {
    const api = await loginAs('STOCK_MANAGER');
    await api('/api/v1/stock/movements?warehouseId=wh-1&type=SALE&from=2026-09-01&to=2026-09-30&page=2&pageSize=50');

    const where = prismaMock.stockMovement.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ storeId: 'store-1', warehouseId: 'wh-1', movementType: 'SALE' });
    expect(where.createdAt.gte).toBeInstanceOf(Date);
    expect(where.createdAt.lte.getHours()).toBe(23);

    const args = prismaMock.stockMovement.findMany.mock.calls[0][0];
    expect(args.skip).toBe(50);
    expect(args.take).toBe(50);
  });

  it('le caissier peut consulter le stock (il vend), un rôle inconnu est bloqué', async () => {
    const cashier = await loginAs('CASHIER');
    expect((await cashier('/api/v1/stock/movements')).status).toBe(200);

    const inconnu = await loginAs('TECHNICIEN');
    const res = await inconnu('/api/v1/stock/movements');
    expect(res.status).toBe(403);
  });
});
