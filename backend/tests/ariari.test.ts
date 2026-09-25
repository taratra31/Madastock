import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import { extractPaymentId } from '../src/services/ariari.service';
import * as billingService from '../src/services/billing.service';

const prismaMock = vi.hoisted(() => ({
  payment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  plan: { findUnique: vi.fn() },
  store: { findUnique: vi.fn() },
  subscription: { findUnique: vi.fn(), upsert: vi.fn() },
  $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock)),
}));

vi.mock('../src/lib/prisma', () => ({
  default: prismaMock,
}));

function ariariPayment(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'pay-ar-1',
    amount: 25000,
    rest: 25000,
    status: 'pending',
    parts: [],
    url: 'https://pay.ariari.mg/testencryptedabc',
    createdAt: '2026-09-23T10:00:00.000Z',
    updatedAt: '2026-09-23T10:00:00.000Z',
    ...overrides,
  };
}

function ariariApiResponse(payment: Record<string, unknown>) {
  return { status: 'ok', message: 'OK', data: payment };
}

const pendingPayment = {
  id: 'pay-1',
  storeId: 'store-1',
  planId: 'plan-1',
  amountAr: '25000',
  merchantReference: 'SUB-store123-11111111-2222-3333-4444-555555555555',
  provider: 'ARIARI',
  currency: 'MGA',
  providerReference: 'pay-ar-1',
  url: 'https://pay.ariari.mg/testencryptedabc',
  status: 'PENDING',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const activePlan = {
  id: 'plan-1',
  name: 'STARTER',
  description: 'Offre STARTER',
  priceAr: '25000',
  billingCycle: 'MONTHLY',
  durationMonths: 1,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(prismaMock));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('extractPaymentId (webhooks silent*)', () => {
  it('extrait id/_id à la racine', () => {
    expect(extractPaymentId(Buffer.from(JSON.stringify({ _id: 'pay-ar-1', status: 'paid' })))).toBe('pay-ar-1');
    expect(extractPaymentId(Buffer.from(JSON.stringify({ id: 'pay-ar-2' })))).toBe('pay-ar-2');
  });

  it('extrait depuis un wrapper data / payment / payload', () => {
    expect(extractPaymentId(Buffer.from(JSON.stringify({ status: 'ok', data: { _id: 'pay-ar-3' } })))).toBe('pay-ar-3');
    expect(extractPaymentId(Buffer.from(JSON.stringify({ payment: { id: 'pay-ar-4' } })))).toBe('pay-ar-4');
    expect(extractPaymentId(Buffer.from(JSON.stringify({ payload: { paymentId: 'pay-ar-5' } })))).toBe('pay-ar-5');
  });

  it('retourne null sur un body invalide ou sans id', () => {
    expect(extractPaymentId(Buffer.from('pas du json'))).toBeNull();
    expect(extractPaymentId(Buffer.from(JSON.stringify({ status: 'paid' })))).toBeNull();
  });
});

describe('Route webhook /api/webhooks/ariari', () => {
  it("200 handled:false pour un body non JSON", async () => {
    const res = await request(app)
      .post('/api/webhooks/ariari')
      .set('Content-Type', 'application/json')
      .send('nimporte quoi');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, handled: false });
  });

  it('200 handled:false pour un paiement Ariari inconnu', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/webhooks/ariari')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ _id: 'pay-introuvable', status: 'paid' }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, handled: false });
  });

  it('200 handled:true et activation quand l API confirme PAID', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(pendingPayment);
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue({ ...pendingPayment, id: 'sub-1', status: 'ACTIVE' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ status: 'paid', rest: 0 }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await request(app)
      .post('/api/webhooks/ariari')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ _id: 'pay-ar-1', status: 'paid' }));

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, handled: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/api/payments/pay-ar-1');
    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) })
    );
    expect(prismaMock.subscription.upsert).toHaveBeenCalledTimes(1);
  });
});

describe('Billing service - activation automatique (re-lecture API)', () => {
  it('PAID => payment SUCCESS + abonnement ACTIVE, même si le webhook arrive d abord', async () => {
    prismaMock.payment.findUnique
      .mockResolvedValueOnce(pendingPayment)
      .mockResolvedValueOnce(pendingPayment);
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    prismaMock.subscription.upsert.mockResolvedValue({ ...pendingPayment, id: 'sub-1', status: 'ACTIVE' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ status: 'paid', rest: 0 }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await billingService.handleWebhook(Buffer.from(JSON.stringify({ _id: 'pay-ar-1', status: 'paid' })));

    expect(result).toEqual({ handled: true });
    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'SUCCESS' }) })
    );
    expect(prismaMock.subscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { storeId: 'store-1' },
        create: expect.objectContaining({ status: 'ACTIVE', planId: 'plan-1' }),
      })
    );
  });

  it('PAID dupliqué => ignoré (idempotence), aucune seconde activation', async () => {
    const paid: typeof pendingPayment = { ...pendingPayment, status: 'SUCCESS', paidAt: new Date() };
    prismaMock.payment.findUnique
      .mockResolvedValueOnce(paid)
      .mockResolvedValueOnce(paid);
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ status: 'paid', rest: 0 }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    await billingService.handleWebhook(Buffer.from(JSON.stringify({ _id: 'pay-ar-1', status: 'paid' })));

    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it('un attaquant ne peut pas inventer un PAID (read-back fait foi)', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(pendingPayment);
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });

    // L'API répond pending alors que le webhook prétend paid.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ status: 'pending', rest: 25000 }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await billingService.handleWebhook(Buffer.from(JSON.stringify({ _id: 'pay-ar-1', status: 'paid' })));

    expect(result).toEqual({ handled: true });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.not.objectContaining({ status: 'SUCCESS' }) })
    );
  });

  it('montant différent => jamais d activation', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(pendingPayment);
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ status: 'paid', rest: 0, amount: 50000 }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await billingService.handleWebhook(Buffer.from(JSON.stringify({ _id: 'pay-ar-1', status: 'paid' })));

    expect(result).toEqual({ handled: true });
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it('FAILED => payment FAILED, aucune activation', async () => {
    prismaMock.payment.findUnique.mockResolvedValue(pendingPayment);
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ status: 'failed' }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await billingService.handleWebhook(Buffer.from(JSON.stringify({ _id: 'pay-ar-1', status: 'failed' })));

    expect(result).toEqual({ handled: true });
    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
    expect(prismaMock.subscription.upsert).not.toHaveBeenCalled();
  });

  it('renouvellement avant expiration : prolonge de N jours depuis currentPeriodEnd', async () => {
    prismaMock.payment.findUnique
      .mockResolvedValueOnce(pendingPayment)
      .mockResolvedValueOnce(pendingPayment);
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });
    const existingEnd = new Date('2026-10-20T00:00:00.000Z');
    const existingSub = {
      id: 'sub-1',
      status: 'ACTIVE',
      currentPeriodStart: new Date('2026-09-20T00:00:00.000Z'),
      currentPeriodEnd: existingEnd,
      planId: 'plan-1',
    };
    prismaMock.subscription.findUnique.mockResolvedValue(existingSub);
    prismaMock.subscription.upsert.mockResolvedValue(existingSub);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ status: 'paid', rest: 0 }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    await billingService.handleWebhook(Buffer.from(JSON.stringify({ _id: 'pay-ar-1', status: 'paid' })));

    const upsertCall = prismaMock.subscription.upsert.mock.calls[0][0];
    // Jours restants conservés + durée du plan en JOURS (plus de « +1 mois »).
    expect(upsertCall.update.currentPeriodStart.toISOString()).toBe('2026-10-20T00:00:00.000Z');
    const expectedEnd = new Date(existingEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
    expect(upsertCall.update.currentPeriodEnd.toISOString()).toBe(expectedEnd.toISOString());
    expect(upsertCall.update.status).toBe('ACTIVE');
  });

  it('paiement répété le même jour : chaque achat ajoute sa durée', async () => {
    prismaMock.payment.findUnique
      .mockResolvedValueOnce(pendingPayment)
      .mockResolvedValueOnce(pendingPayment);
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1' });
    const existingEnd = new Date('2026-10-20T00:00:00.000Z');
    prismaMock.subscription.findUnique.mockResolvedValue({
      id: 'sub-1',
      status: 'ACTIVE',
      currentPeriodStart: new Date('2026-09-20T00:00:00.000Z'),
      currentPeriodEnd: existingEnd,
      planId: 'plan-1',
    });
    prismaMock.subscription.upsert.mockResolvedValue({ id: 'sub-1' });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ status: 'paid', rest: 0 }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    await billingService.handleWebhook(Buffer.from(JSON.stringify({ _id: 'pay-ar-1', status: 'paid' })));

    const end = prismaMock.subscription.upsert.mock.calls[0][0].update.currentPeriodEnd as Date;
    const days = Math.round((end.getTime() - existingEnd.getTime()) / (24 * 60 * 60 * 1000));
    expect(days).toBe(30);
  });
});

describe('Création de paiement (createCheckout)', () => {
  it('refuse un plan inexistant', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(null);
    await expect(billingService.createCheckout('store-1', 'user-1', 'plan-inconnu')).rejects.toThrow('Offre introuvable');
  });

  it('refuse un plan inactif', async () => {
    prismaMock.plan.findUnique.mockResolvedValue({ ...activePlan, isActive: false });
    await expect(billingService.createCheckout('store-1', 'user-1', 'plan-1')).rejects.toThrow('Offre introuvable');
  });

  it('le montant vient de la base de données et le lien créé est renvoyé', async () => {
    prismaMock.plan.findUnique.mockResolvedValue({ ...activePlan, priceAr: '50000' });
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1', name: 'Mounaya', email: null });
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1', merchantReference: 'SUB-user-1-abc' });
    prismaMock.payment.update.mockResolvedValue({});

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(ariariApiResponse(ariariPayment({ amount: 50000, status: 'pending' }))),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await billingService.createCheckout('store-1', 'user-1', 'plan-1');

    expect(result.paymentLink).toBe('https://pay.ariari.mg/testencryptedabc');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('https://api.ariari.mg/api/payments');
    expect(init.headers['x-secret']).toBeDefined();
    const sentBody = JSON.parse(init.body);
    expect(sentBody.amount).toBe(50000); // prix DB, jamais le frontend
    expect(sentBody.hooks.silentSuccess).toContain('/api/webhooks/ariari');
    expect(prismaMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amountAr: '50000',
          provider: 'ARIARI',
          merchantReference: expect.stringMatching(/^SUB-/),
          status: 'PENDING',
        }),
      })
    );
  });

  it('une erreur API Ariari est propagée et la commande locale passe FAILED', async () => {
    prismaMock.plan.findUnique.mockResolvedValue(activePlan);
    prismaMock.store.findUnique.mockResolvedValue({ id: 'store-1', name: 'Mounaya', email: null });
    prismaMock.payment.create.mockResolvedValue({ id: 'pay-1', merchantReference: 'SUB-xxxx' });
    prismaMock.payment.update.mockResolvedValue({});

    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ status: 'error', message: 'Secret invalide' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(billingService.createCheckout('store-1', 'user-1', 'plan-1')).rejects.toThrowError();
    expect(prismaMock.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
  });
});

describe("Sécurité des routes billing", () => {
  it('POST /api/v1/billing/checkout sans token => 401', async () => {
    const res = await request(app).post('/api/v1/billing/checkout').send({ planId: 'plan-1' });
    expect(res.status).toBe(401);
  });
});