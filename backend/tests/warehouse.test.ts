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
    warehouse: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    stock: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    stockMovement: { createMany: vi.fn() },
  };
  // Les transactions « callback » reçoivent le client lui-même (comme Prisma).
  self.$transaction = vi.fn(async (fn: (tx: unknown) => unknown) => fn(self));
  return self as never;
});

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

const mainWarehouse = {
  id: 'wh-main',
  storeId: 'store-1',
  name: 'Dépôt principal',
  address: null,
  isMain: true,
  isActive: true,
};

const secondWarehouse = {
  id: 'wh-2',
  storeId: 'store-1',
  name: 'Dépôt II',
  address: null,
  isMain: false,
  isActive: true,
};

const productId = '11111111-1111-4111-8111-111111111111';

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
  const auth = { Authorization: `Bearer ${token}`, 'X-Store-Id': 'store-1' };
  return {
    get: (url: string) => request(app).get(url).set(auth),
    post: (url: string, body?: unknown) => request(app).post(url).set(auth).send(body ?? {}),
    patch: (url: string, body?: unknown) => request(app).patch(url).set(auth).send(body ?? {}),
    del: (url: string) => request(app).delete(url).set(auth),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.warehouse.findMany.mockResolvedValue([mainWarehouse, secondWarehouse]);
});

describe('Dépôts', () => {
  it('liste les dépôts avec le nombre de références et la valeur du stock', async () => {
    prismaMock.warehouse.findMany.mockResolvedValue([
      {
        ...mainWarehouse,
        _count: { stocks: 2 },
        stocks: [
          { quantityAr: 10, product: { costPriceAr: 2500 } },
          { quantityAr: 5, product: { costPriceAr: 1000 } },
        ],
      },
    ]);

    const api = await loginAs('CASHIER');
    const res = await api.get('/api/v1/warehouses');

    expect(res.status).toBe(200);
    expect(res.body[0]).toMatchObject({ name: 'Dépôt principal', productCount: 2, totalUnits: 15, totalValueAr: 30000 });
  });

  it('le caissier peut lire mais pas créer de dépôt', async () => {
    const api = await loginAs('CASHIER');
    expect((await api.post('/api/v1/warehouses', { name: 'Nouveau' })).status).toBe(403);

    const manager = await loginAs('STOCK_MANAGER');
    expect((await manager.post('/api/v1/warehouses', { name: 'Nouveau' })).status).toBe(201);
  });

  it('un dépôt ne peut pas être supprimé s’il contient du stock', async () => {
    prismaMock.warehouse.findFirst.mockResolvedValue(secondWarehouse);
    prismaMock.stock.count.mockResolvedValue(4);

    const api = await loginAs('STOCK_MANAGER');
    const res = await api.del('/api/v1/warehouses/wh-2');
    expect(res.status).toBe(409);
    expect(prismaMock.warehouse.delete).not.toHaveBeenCalled();
  });

  it('le dépôt principal ne peut pas être supprimé', async () => {
    prismaMock.warehouse.findFirst.mockResolvedValue(mainWarehouse);

    const api = await loginAs('STOCK_MANAGER');
    const res = await api.del('/api/v1/warehouses/wh-main');
    expect(res.status).toBe(400);
  });
});

describe('Transfert entre dépôts', () => {
  it('déplace la quantité et écrit les deux mouvements', async () => {
    prismaMock.warehouse.findFirst
      .mockResolvedValueOnce(mainWarehouse)
      .mockResolvedValueOnce(secondWarehouse);
    prismaMock.stock.findFirst
      .mockResolvedValueOnce({ id: 'st-src', quantityAr: 20, reservedQty: 2 })
      .mockResolvedValueOnce(null);

    const api = await loginAs('STOCK_MANAGER');
    const res = await api.post('/api/v1/warehouses/transfers', {
      productId,
      fromWarehouseId: 'wh-main',
      toWarehouseId: 'wh-2',
      quantity: 5,
    });

    expect(res.status).toBe(201);
    expect(res.body.quantity).toBe(5);

    // 20 - 5 dans le dépôt source, et création de la ligne dans la destination.
    expect(prismaMock.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'st-src' }, data: { quantityAr: 15 } }),
    );
    expect(prismaMock.stock.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ warehouseId: 'wh-2', quantityAr: 5 }) }),
    );

    const movements = prismaMock.stockMovement.createMany.mock.calls[0][0].data;
    expect(movements.map((m: { movementType: string }) => m.movementType)).toEqual([
      'TRANSFER_OUT',
      'TRANSFER_IN',
    ]);
    expect(movements[0].referenceId).toBe(movements[1].referenceId);
  });

  it('refuse un transfert supérieur au stock disponible (quantité réservée exclue)', async () => {
    prismaMock.warehouse.findFirst
      .mockResolvedValueOnce(mainWarehouse)
      .mockResolvedValueOnce(secondWarehouse);
    prismaMock.stock.findFirst.mockResolvedValueOnce({ id: 'st-src', quantityAr: 6, reservedQty: 4 });

    const api = await loginAs('STOCK_MANAGER');
    const res = await api.post('/api/v1/warehouses/transfers', {
      productId,
      fromWarehouseId: 'wh-main',
      toWarehouseId: 'wh-2',
      quantity: 5,
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/disponible/i);
    expect(prismaMock.stockMovement.createMany).not.toHaveBeenCalled();
  });

  it('refuse le transfert vers le même dépôt', async () => {
    const api = await loginAs('STOCK_MANAGER');
    const res = await api.post('/api/v1/warehouses/transfers', {
      productId,
      fromWarehouseId: 'wh-main',
      toWarehouseId: 'wh-main',
      quantity: 1,
    });
    expect(res.status).toBe(400);
  });
});
