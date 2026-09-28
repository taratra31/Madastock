import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireLiveWrite } from '../src/middleware/plan';
import { getSubscriptionState } from '../src/services/subscription.service';
import type { Request, Response, NextFunction } from 'express';

const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
}));

vi.mock('../src/lib/prisma', () => ({
  default: prismaMock,
}));

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as unknown as { store?: { id: string } }).store = { id: 'store-1' };
    next();
  });
  app.use(requireLiveWrite);
  app.post('/write', (_req, res) => res.json({ ok: true }));
  app.delete('/delete', (_req, res) => res.json({ ok: true }));
  app.get('/read', (_req, res) => res.json({ ok: true }));
  // Même formateur d'erreur que app.ts : { error: message }.
  app.use((err: { statusCode?: number; message: string }, _req: Request, res: Response, _next: NextFunction) => {
    res.status(err.statusCode ?? 500).json({ error: err.message });
  });
  return app;
}

function mockSub(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    storeId: 'store-1',
    planId: 'plan-1',
    status: 'ACTIVE',
    currentPeriodStart: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
    plan: { name: 'STARTER', priceAr: '25000', durationDays: 30, durationMonths: null, featuresJson: '{"pos":true,"stock":true,"reports":true}' },
    store: { billingExempt: false },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('requireLiveWrite', () => {
  it('abonnement actif : les écritures et lectures passent', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(mockSub());
    const app = makeApp();
    expect((await request(app).post('/write').send({})).status).toBe(200);
    expect((await request(app).delete('/delete')).status).toBe(200);
    expect((await request(app).get('/read')).status).toBe(200);
  });

  it('abonnement expiré : écritures bloquées en 402, lectures autorisées', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      mockSub({ currentPeriodEnd: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) }),
    );
    const app = makeApp();
    const post = await request(app).post('/write').send({});
    expect(post.status).toBe(402);
    expect(post.body.error).toBe('Votre abonnement a expiré. Renouvelez-le pour continuer à utiliser MadaStock.');
    const del = await request(app).delete('/delete');
    expect(del.status).toBe(402);
    const get = await request(app).get('/read');
    expect(get.status).toBe(200);
  });

  it('essai gratuit en cours : aucune restriction', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(mockSub({ status: 'TRIALING' }));
    const app = makeApp();
    expect((await request(app).post('/write').send({})).status).toBe(200);
  });

  it('boutique interne (billingExempt) : jamais bloquée même expirée', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      mockSub({ store: { billingExempt: true }, currentPeriodEnd: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }),
    );
    const app = makeApp();
    expect((await request(app).post('/write').send({})).status).toBe(200);
  });

  it('boutique sans abonnement : non verrouillée (évite tout blocage accidentel)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(null);
    const app = makeApp();
    expect((await request(app).post('/write').send({})).status).toBe(200);
  });
});

describe('getSubscriptionState', () => {
  it('expose les fonctionnalités du plan (featuresJson parsé)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue({
      ...mockSub(),
      trialEndsAt: null,
      status: 'ACTIVE',
    });
    const state = await getSubscriptionState('store-1', new Date());
    expect(state?.features).toEqual({ pos: true, stock: true, reports: true });
    expect(state?.isLive).toBe(true);
  });

  it('features vides quand featuresJson est illisible', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      mockSub({ plan: { name: 'STARTER', priceAr: '25000', durationDays: 30, durationMonths: null, featuresJson: 'not-json' } }),
    );
    const state = await getSubscriptionState('store-1', new Date());
    expect(state?.features).toEqual({});
  });
});