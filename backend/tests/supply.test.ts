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
  storeMember: { findUnique: vi.fn() },
  store: { findUnique: vi.fn() },
  supplier: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  brand: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  purchase: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  purchaseItem: { update: vi.fn() },
  product: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
  warehouse: { findFirst: vi.fn(), findMany: vi.fn() },
  stock: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  stockMovement: { create: vi.fn() },
  expense: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  cashSession: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  cashTransaction: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    aggregate: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({
  default: prismaMock,
}));

const membership = {
  role: 'OWNER' as const,
  isOwner: true,
  canManageAll: true,
  store: { id: 'store-1', active: true },
};

async function authAgent() {
  prismaMock.user.findUnique.mockResolvedValue(mockUser);
  prismaMock.storeMember.findUnique.mockResolvedValue(membership);
  const res = await request(app).post('/api/v1/auth/login').send({ email: 'owner@madastock.mg', password: 'password123' });
  const token = res.body.token as string;
  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`).set('X-Store-Id', 'store-1'),
    post: (url: string, body?: unknown) => request(app).post(url).set('Authorization', `Bearer ${token}`).set('X-Store-Id', 'store-1').send(body ?? {}),
    put: (url: string, body?: unknown) => request(app).put(url).set('Authorization', `Bearer ${token}`).set('X-Store-Id', 'store-1').send(body ?? {}),
    patch: (url: string, body?: unknown) => request(app).patch(url).set('Authorization', `Bearer ${token}`).set('X-Store-Id', 'store-1').send(body ?? {}),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`).set('X-Store-Id', 'store-1'),
  };
}

const mockSupplier = {
  id: 'supplier-1',
  storeId: 'store-1',
  name: 'Grossiste Mada',
  contactName: 'Rakoto',
  phone: '0341234567',
  email: 'contact@grossiste.mg',
  address: 'Analakely',
  notes: null,
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

const mockPurchase = {
  id: 'purchase-1',
  storeId: 'store-1',
  supplierId: 'supplier-1',
  warehouseId: 'wh-1',
  referenceNo: 'ACH-0001',
  status: 'ORDERED',
  subtotalAr: 100000,
  discountAr: 0,
  taxAr: 0,
  shippingAr: 0,
  totalAr: 100000,
  amountPaidAr: 40000,
  expectedAt: null,
  receivedAt: null,
  notes: null,
  createdAt: new Date('2026-02-01T00:00:00.000Z'),
  supplier: { id: 'supplier-1', name: 'Grossiste Mada', phone: '0341234567', email: null },
  warehouse: { id: 'wh-1', name: 'Dépôt principal', isMain: true },
  items: [
    {
      id: 'pi-1',
      productId: 'product-1',
      variantId: null,
      quantityAr: 10,
      receivedQtyAr: 0,
      unitCostAr: 10000,
      discountAr: 0,
      taxAr: 0,
      lineTotalAr: 100000,
      product: { id: 'product-1', name: 'Riz 5kg', sku: 'RIZ-5', unit: 'sacs', imageUrl: null },
      variant: null,
    },
  ],
};

const mockSessionOpen = {
  id: 'session-1',
  storeId: 'store-1',
  openedById: 'user-owner',
  openedAt: new Date('2026-03-01T08:00:00.000Z'),
  closedAt: null,
  openingBalanceAr: 50000,
  closingBalanceAr: null,
  expectedCloseAr: null,
  differenceAr: null,
  status: 'OPEN',
  notes: null,
  closedById: null,
  openedBy: { id: 'user-owner', fullName: 'Owner User' },
};

describe('Fournisseurs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });
  });

  it('liste les fournisseurs avec le total d\'achats et le reste dû', async () => {
    prismaMock.supplier.findMany.mockResolvedValue([mockSupplier]);
    prismaMock.supplier.count.mockResolvedValue(1);
    prismaMock.purchase.groupBy.mockResolvedValue([
      { supplierId: 'supplier-1', _sum: { totalAr: 100000, amountPaidAr: 40000 }, _count: { _all: 3 }, _max: { createdAt: new Date('2026-02-01') } },
    ]);

    const api = await authAgent();
    const res = await api.get('/api/v1/suppliers');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].purchasesCount).toBe(3);
    expect(res.body.data[0].outstandingAr).toBe(60000);
    expect(res.body.pagination.total).toBe(1);
  });

  it('refuse l\'accès sans en-tête boutique', async () => {
    const res = await request(app).get('/api/v1/suppliers');
    expect(res.status).toBe(401);
  });

  it('crée un fournisseur', async () => {
    prismaMock.supplier.create.mockResolvedValue(mockSupplier);
    const api = await authAgent();
    const res = await api.post('/api/v1/suppliers', { name: 'Grossiste Mada', phone: '0341234567' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Grossiste Mada');
  });

  it('valide le nom du fournisseur', async () => {
    const api = await authAgent();
    const res = await api.post('/api/v1/suppliers', { phone: '0341234567' });
    expect(res.status).toBe(400);
  });

  it('refuse de supprimer un fournisseur qui a des achats', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(mockSupplier);
    prismaMock.purchase.count.mockResolvedValue(2);

    const api = await authAgent();
    const res = await api.delete('/api/v1/suppliers/supplier-1');

    expect(res.status).toBe(400);
    expect(prismaMock.supplier.delete).not.toHaveBeenCalled();
  });

  it('supprime un fournisseur sans achat', async () => {
    prismaMock.supplier.findFirst.mockResolvedValue(mockSupplier);
    prismaMock.purchase.count.mockResolvedValue(0);
    prismaMock.supplier.delete.mockResolvedValue({});

    const api = await authAgent();
    const res = await api.delete('/api/v1/suppliers/supplier-1');

    expect(res.status).toBe(204);
  });

  it('donne les statistiques fournisseurs', async () => {
    prismaMock.supplier.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    prismaMock.purchase.findMany.mockResolvedValue([
      { totalAr: 100000, amountPaidAr: 40000 },
      { totalAr: 50000, amountPaidAr: 50000 },
    ]);
    prismaMock.purchase.aggregate.mockResolvedValue({ _sum: { totalAr: 150000 }, _count: 2 });
    prismaMock.purchase.groupBy.mockResolvedValue([{ supplierId: 'supplier-1', _sum: { totalAr: 100000 } }]);
    prismaMock.supplier.findMany.mockResolvedValue([{ id: 'supplier-1', name: 'Grossiste Mada' }]);

    const api = await authAgent();
    const res = await api.get('/api/v1/suppliers/stats');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.outstandingAr).toBe(60000);
    expect(res.body.topSuppliers[0].name).toBe('Grossiste Mada');
  });
});

describe('Marques', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('liste les marques', async () => {
    prismaMock.brand.findMany.mockResolvedValue([
      { id: 'brand-1', storeId: 'store-1', name: 'Ny Sakafo', logoUrl: null, isActive: true, createdAt: new Date(), updatedAt: new Date(), _count: { products: 4 } },
    ]);

    const api = await authAgent();
    const res = await api.get('/api/v1/brands');

    expect(res.status).toBe(200);
    expect(res.body[0]._count.products).toBe(4);
  });

  it('crée une marque', async () => {
    prismaMock.brand.create.mockResolvedValue({ id: 'brand-2', storeId: 'store-1', name: 'Bao', logoUrl: null, isActive: true, createdAt: new Date(), updatedAt: new Date() });
    const api = await authAgent();
    const res = await api.post('/api/v1/brands', { name: 'Bao' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Bao');
  });

  it('refuse de supprimer une marque utilisée par des produits', async () => {
    prismaMock.brand.findFirst.mockResolvedValue({ id: 'brand-1', storeId: 'store-1', name: 'Ny Sakafo', _count: { products: 2 } });
    prismaMock.product.count.mockResolvedValue(2);
    prismaMock.brand.delete.mockResolvedValue({});

    const api = await authAgent();
    const res = await api.delete('/api/v1/brands/brand-1');

    expect(res.status).toBe(400);
    expect(prismaMock.brand.delete).not.toHaveBeenCalled();
  });
});

describe('Achats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });
  });

  it('liste les achats avec le reste dû', async () => {
    prismaMock.purchase.findMany.mockResolvedValue([mockPurchase]);
    prismaMock.purchase.count.mockResolvedValue(1);

    const api = await authAgent();
    const res = await api.get('/api/v1/purchases');

    expect(res.status).toBe(200);
    expect(res.body.data[0].dueAr).toBe(60000);
    expect(res.body.data[0].itemsCount).toBe(1);
    expect(res.body.data[0].items[0].productName).toBe('Riz 5kg');
  });

  it('crée un achat et Receptionné : le stock est mouvementé', async () => {
    prismaMock.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', storeId: 'store-1', name: 'Dépôt', isActive: true });
    prismaMock.supplier.findFirst.mockResolvedValue(mockSupplier);
    prismaMock.product.findMany.mockResolvedValue([{ id: 'product-1', name: 'Riz 5kg' }]);
    prismaMock.purchase.count.mockResolvedValue(0);

    const tx = {
      purchase: { create: vi.fn().mockResolvedValue({ id: 'purchase-1', referenceNo: 'ACH-0002' }), count: vi.fn().mockResolvedValue(0) },
      purchaseItem: { update: vi.fn() },
      product: { update: vi.fn().mockResolvedValue({}) },
      stock: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}), update: vi.fn() },
      stockMovement: { create: vi.fn().mockResolvedValue({}) },
      store: { findUnique: vi.fn().mockResolvedValue({ id: 'store-1' }) },
    };
    prismaMock.$transaction.mockImplementation(async (fn: (t: any) => Promise<unknown>) => fn(tx));
    prismaMock.purchase.findFirst.mockResolvedValue({
      ...mockPurchase,
      status: 'RECEIVED',
      receivedAt: new Date(),
      items: [{ ...mockPurchase.items[0], receivedQtyAr: 10 }],
    });

    const api = await authAgent();
    const res = await api.post('/api/v1/purchases', {
      supplierId: 'supplier-1',
      warehouseId: 'wh-1',
      status: 'RECEIVED',
      amountPaidAr: 0,
      items: [{ productId: 'product-1', quantity: 10, unitCostAr: 10000 }],
    });

    expect(res.status).toBe(201);
    expect(tx.stock.create).toHaveBeenCalledTimes(1);
    expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 'product-1' }, data: { costPriceAr: 10000 } });
  });

  it('refuse un achat sans article', async () => {
    prismaMock.warehouse.findFirst.mockResolvedValue({ id: 'wh-1', storeId: 'store-1', isActive: true });
    const api = await authAgent();
    const res = await api.post('/api/v1/purchases', { warehouseId: 'wh-1', items: [] });
    expect(res.status).toBe(400);
  });

  it('réceptionne un achat commandé : le stock manquant est ajouté', async () => {
    prismaMock.purchase.findFirst.mockResolvedValue(mockPurchase);
    prismaMock.purchase.findMany.mockResolvedValue([{ ...mockPurchase, status: 'RECEIVED' }]);

    const tx = {
      purchase: { update: vi.fn().mockResolvedValue({}) },
      purchaseItem: { update: vi.fn().mockResolvedValue({}) },
      stock: { findFirst: vi.fn().mockResolvedValue({ id: 'stock-1' }), create: vi.fn(), update: vi.fn().mockResolvedValue({}) },
      stockMovement: { create: vi.fn().mockResolvedValue({}) },
    };
    prismaMock.$transaction.mockImplementation(async (fn: (t: any) => Promise<unknown>) => fn(tx));
    prismaMock.purchase.count.mockResolvedValue(1);

    const api = await authAgent();
    const res = await api.patch('/api/v1/purchases/purchase-1/status', { status: 'RECEIVED' });

    expect(res.status).toBe(200);
    expect(tx.stock.update).toHaveBeenCalledWith({ where: { id: 'stock-1' }, data: { quantityAr: { increment: 10 } } });
  });

  it('refuse de supprimer un achat réceptionné', async () => {
    prismaMock.purchase.findFirst.mockResolvedValue({ ...mockPurchase, status: 'RECEIVED', items: [{ ...mockPurchase.items[0], receivedQtyAr: 10 }] });

    const api = await authAgent();
    const res = await api.delete('/api/v1/purchases/purchase-1');

    expect(res.status).toBe(400);
    expect(prismaMock.purchase.delete).not.toHaveBeenCalled();
  });

  it('donne les statistiques d\'achats', async () => {
    prismaMock.purchase.findMany.mockResolvedValue([{ totalAr: 100000, amountPaidAr: 40000 }]);
    prismaMock.purchase.aggregate.mockResolvedValue({ _sum: { totalAr: 100000 }, _count: 1 });
    prismaMock.purchase.count.mockResolvedValue(2);
    prismaMock.purchase.groupBy.mockResolvedValue([]);

    const api = await authAgent();
    const res = await api.get('/api/v1/purchases/stats');

    expect(res.status).toBe(200);
    expect(res.body.totalPurchasesAr).toBe(100000);
    expect(res.body.outstandingAr).toBe(60000);
    expect(res.body.pendingCount).toBe(2);
  });
});

describe('Dépenses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockExpense = {
    id: 'expense-1',
    storeId: 'store-1',
    category: 'RENT',
    description: 'Loyer mars',
    amountAr: 150000,
    incurredAt: new Date('2026-03-05T00:00:00.000Z'),
    paymentMethod: 'CASH',
    receiptUrl: null,
    createdById: 'user-owner',
    createdAt: new Date('2026-03-05T00:00:00.000Z'),
  };

  it('liste les dépenses', async () => {
    prismaMock.expense.findMany.mockResolvedValue([mockExpense]);
    prismaMock.expense.count.mockResolvedValue(1);

    const api = await authAgent();
    const res = await api.get('/api/v1/expenses');

    expect(res.status).toBe(200);
    expect(res.body.data[0].amountAr).toBe(150000);
  });

  it('crée une dépense en espèces : le mouvement de caisse est enregistré', async () => {
    prismaMock.expense.create.mockResolvedValue(mockExpense);
    prismaMock.cashSession.findFirst.mockResolvedValue(mockSessionOpen);
    prismaMock.cashTransaction.create.mockResolvedValue({});

    const api = await authAgent();
    const res = await api.post('/api/v1/expenses', { category: 'RENT', amountAr: 150000, paymentMethod: 'CASH' });

    expect(res.status).toBe(201);
    expect(prismaMock.cashTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ transactionType: 'EXPENSE', amountAr: -150000 }) }),
    );
  });

  it('crée une dépense sans cassette : la dépense passe quand même', async () => {
    prismaMock.expense.create.mockResolvedValue(mockExpense);
    prismaMock.cashSession.findFirst.mockResolvedValue(null);

    const api = await authAgent();
    const res = await api.post('/api/v1/expenses', { category: 'RENT', amountAr: 150000, paymentMethod: 'CASH' });

    expect(res.status).toBe(201);
    expect(prismaMock.cashTransaction.create).not.toHaveBeenCalled();
  });

  it('refuse un montant nul', async () => {
    const api = await authAgent();
    const res = await api.post('/api/v1/expenses', { category: 'RENT', amountAr: 0 });
    expect(res.status).toBe(400);
  });

  it('donne les statistiques du mois et le top des catégories', async () => {
    prismaMock.expense.aggregate.mockResolvedValueOnce({ _sum: { amountAr: 200000 }, _count: 4 });
    prismaMock.expense.aggregate.mockResolvedValueOnce({ _sum: { amountAr: 100000 } });
    prismaMock.expense.aggregate.mockResolvedValueOnce({ _sum: { amountAr: 20000 } });
    prismaMock.expense.groupBy.mockResolvedValue([
      { category: 'RENT', _sum: { amountAr: 150000 }, _count: 1 },
      { category: 'TRANSPORT', _sum: { amountAr: 50000 }, _count: 3 },
    ]);

    const api = await authAgent();
    const res = await api.get('/api/v1/expenses/stats');

    expect(res.status).toBe(200);
    expect(res.body.monthTotalAr).toBe(200000);
    expect(res.body.variationPct).toBe(100);
    expect(res.body.byCategory[0].sharePct).toBe(75);
  });

  it('supprime la dépense et son mouvement de caisse', async () => {
    prismaMock.expense.findFirst.mockResolvedValue(mockExpense);
    prismaMock.expense.delete.mockResolvedValue({});
    prismaMock.cashTransaction.deleteMany.mockResolvedValue({ count: 1 });

    const api = await authAgent();
    const res = await api.delete('/api/v1/expenses/expense-1');

    expect(res.status).toBe(204);
    expect(prismaMock.cashTransaction.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ expenseId: 'expense-1' }) }),
    );
  });
});

describe('Caisse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('indique qu\'aucune caisse n\'est ouverte', async () => {
    prismaMock.cashSession.findFirst.mockResolvedValue(null);
    const api = await authAgent();
    const res = await api.get('/api/v1/cash/current');

    expect(res.status).toBe(200);
    expect(res.body.open).toBe(false);
  });

  it('ouvre la caisse', async () => {
    prismaMock.cashSession.findFirst.mockResolvedValue(null);
    prismaMock.cashSession.create.mockResolvedValue(mockSessionOpen);

    const api = await authAgent();
    const res = await api.post('/api/v1/cash/open', { openingBalanceAr: 50000 });

    expect(res.status).toBe(201);
    expect(res.body.openingBalanceAr).toBe(50000);
  });

  it('refuse d\'ouvrir une deuxième caisse', async () => {
    prismaMock.cashSession.findFirst.mockResolvedValue(mockSessionOpen);
    const api = await authAgent();
    const res = await api.post('/api/v1/cash/open', { openingBalanceAr: 50000 });

    expect(res.status).toBe(400);
  });

  it('clôture la caisse et calcule l\'écart', async () => {
    prismaMock.cashSession.findFirst.mockResolvedValue(mockSessionOpen);
    prismaMock.cashTransaction.aggregate.mockResolvedValue({ _sum: { amountAr: 120000 }, _count: 3 });
    prismaMock.cashSession.update.mockResolvedValue({
      ...mockSessionOpen,
      status: 'CLOSED',
      closedAt: new Date(),
      closingBalanceAr: 165000,
      expectedCloseAr: 170000,
      differenceAr: -5000,
    });

    const api = await authAgent();
    const res = await api.post('/api/v1/cash/close', { closingBalanceAr: 165000 });

    expect(res.status).toBe(200);
    expect(res.body.expectedCloseAr).toBe(170000);
    expect(res.body.differenceAr).toBe(-5000);
  });

  it('ajoute un dépôt manuel', async () => {
    prismaMock.cashSession.findFirst.mockResolvedValue(mockSessionOpen);
    prismaMock.cashTransaction.create.mockResolvedValue({
      id: 'tx-1',
      transactionType: 'DEPOSIT',
      amountAr: 25000,
      method: 'CASH',
      description: 'Dépôt espèces',
      createdAt: new Date(),
    });
    prismaMock.cashSession.findUnique.mockResolvedValue(mockSessionOpen);
    prismaMock.cashTransaction.aggregate.mockResolvedValue({ _sum: { amountAr: 25000 }, _count: 1 });

    const api = await authAgent();
    const res = await api.post('/api/v1/cash/transactions', { transactionType: 'DEPOSIT', amountAr: 25000 });

    expect(res.status).toBe(201);
    expect(prismaMock.cashTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ amountAr: 25000, source: 'MANUAL' }) }),
    );
  });

  it('retire des espèces (montant négatif)', async () => {
    prismaMock.cashSession.findFirst.mockResolvedValue(mockSessionOpen);
    prismaMock.cashTransaction.create.mockResolvedValue({
      id: 'tx-2',
      transactionType: 'WITHDRAWAL',
      amountAr: -10000,
      method: 'CASH',
      description: null,
      createdAt: new Date(),
    });
    prismaMock.cashSession.findUnique.mockResolvedValue(mockSessionOpen);
    prismaMock.cashTransaction.aggregate.mockResolvedValue({ _sum: { amountAr: -10000 }, _count: 1 });

    const api = await authAgent();
    const res = await api.post('/api/v1/cash/transactions', { transactionType: 'WITHDRAWAL', amountAr: 10000 });

    expect(res.status).toBe(201);
    expect(res.body.netAr).toBe(-10000);
  });

  it('liste les sessions passées', async () => {
    prismaMock.cashSession.findMany.mockResolvedValue([
      { ...mockSessionOpen, status: 'CLOSED', closedAt: new Date(), closingBalanceAr: 165000, expectedCloseAr: 170000, differenceAr: -5000 },
    ]);
    prismaMock.cashSession.count.mockResolvedValue(1);
    prismaMock.cashTransaction.aggregate.mockResolvedValue({ _sum: { amountAr: 120000 }, _count: 5 });

    const api = await authAgent();
    const res = await api.get('/api/v1/cash/sessions');

    expect(res.status).toBe(200);
    expect(res.body.data[0].theoreticalAr).toBe(170000);
    expect(res.body.data[0].differenceAr).toBe(-5000);
  });
});
