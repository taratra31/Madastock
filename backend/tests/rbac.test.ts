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
  product: { findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  stock: { findMany: vi.fn() },
  reminder: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({ default: prismaMock }));

const plan = {
  id: 'plan-pro',
  name: 'PRO',
  priceAr: 120000,
  durationDays: 30,
  durationMonths: 1,
  billingCycle: 'MONTHLY',
  isActive: true,
  featuresJson: '{}',
};

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
  plan,
  store: { billingExempt: false },
};

const product = {
  id: 'p1',
  storeId: 'store-1',
  name: 'Riz 1kg',
  slug: 'riz-1kg',
  description: null,
  categoryId: null,
  brandId: null,
  sku: 'RIZ1',
  barcode: '1234567890',
  imageUrl: null,
  unit: 'piece',
  costPriceAr: 2500,
  sellingPriceAr: 3500,
  wholesalePriceAr: null,
  taxRatePct: 0,
  lowStockThreshold: 5,
  trackStock: true,
  sellByWeight: false,
  hasVariants: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  category: null,
  brand: null,
  stocks: [{ quantityAr: 3, reservedQty: 0 }],
  _count: { variants: 0 },
};

async function loginAs(role: string, isOwner = false) {
  prismaMock.user.findUnique.mockResolvedValue(mockUser);
  prismaMock.storeMember.findUnique.mockResolvedValue({
    role,
    isOwner,
    canManageAll: false,
    store: { id: 'store-1', active: true },
  });
  prismaMock.subscription.findUnique.mockResolvedValue(subscription);
  prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1', billingExempt: false, name: 'Boutique Test' });

  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'staff@madastock.mg', password: 'password123' });
  const token = res.body.token as string;
  const auth = { Authorization: `Bearer ${token}`, 'X-Store-Id': 'store-1' };
  return {
    get: (url: string) => request(app).get(url).set(auth),
    post: (url: string, body?: unknown) => request(app).post(url).set(auth).send(body ?? {}),
    put: (url: string, body?: unknown) => request(app).put(url).set(auth).send(body ?? {}),
    del: (url: string) => request(app).delete(url).set(auth),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.product.findMany.mockResolvedValue([product]);
});

describe('RBAC — permissions par rôle', () => {
  it('le caissier peut lire les produits MAIS les prix d’achat sont masqués', async () => {
    const api = await loginAs('CASHIER');
    const res = await api.get('/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body.data[0].costPriceAr).toBeNull();
    expect(res.body.data[0].sellingPriceAr).toBe(3500);
  });

  it('le caissier ne peut PAS créer ni supprimer un produit (403)', async () => {
    const api = await loginAs('CASHIER');
    expect((await api.post('/api/v1/products', { name: 'X' })).status).toBe(403);
    expect((await api.del('/api/v1/products/p1')).status).toBe(403);
  });

  it('le caissier ne peut PAS modifier le stock (403)', async () => {
    const api = await loginAs('CASHIER');
    const res = await api.post('/api/v1/stock/adjust', { productId: 'p1', warehouseId: 'w1', quantity: 1 });
    expect(res.status).toBe(403);
  });

  it('le caissier ne peut PAS écrire de facture ni de dépense (403)', async () => {
    const api = await loginAs('CASHIER');
    expect((await api.post('/api/v1/invoices', {})).status).toBe(403);
    expect((await api.post('/api/v1/expenses', {})).status).toBe(403);
  });

  it('le gestionnaire des stocks peut écrire le stock mais pas vendre', async () => {
    const api = await loginAs('STOCK_MANAGER');
    // 400 = il a bien passé le garde-fou RBAC, la validation a échoué ensuite.
    expect((await api.post('/api/v1/stock/adjust', { quantity: 1 })).status).not.toBe(403);
    expect((await api.post('/api/v1/sales', {})).status).toBe(403);
  });

  it('le comptable peut créer des factures, le caissier non', async () => {
    const comptable = await loginAs('ACCOUNTANT');
    expect((await comptable.post('/api/v1/invoices', {})).status).not.toBe(403);
    const caissier = await loginAs('CASHIER');
    expect((await caissier.post('/api/v1/invoices', {})).status).toBe(403);
  });

  it('GET /permissions reflète le rôle du membre', async () => {
    const caissier = await loginAs('CASHIER');
    const res = await caissier.get('/api/v1/permissions');
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('CASHIER');
    expect(res.body.permissions).toContain('sale.create');
    expect(res.body.permissions).not.toContain('cost.view');
    expect(res.body.permissions).not.toContain('stock.write');

    const patron = await loginAs('MANAGER', true);
    const res2 = await patron.get('/api/v1/permissions');
    expect(res2.body.permissions).toContain('billing.write');
    expect(res2.body.permissions.length).toBeGreaterThan(30);
  });

  it('un rôle inconnu n’obtient AUCUNE permission (fail-closed)', async () => {
    const api = await loginAs('PIRATE');
    expect((await api.post('/api/v1/products', { name: 'X' })).status).toBe(403);
    expect((await api.get('/api/v1/products')).status).toBe(403);
  });
});
