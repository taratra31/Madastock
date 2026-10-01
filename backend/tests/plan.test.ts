import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const prismaMock = vi.hoisted(() => ({
  subscription: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  store: { findUnique: vi.fn() },
}));

vi.mock('../src/lib/prisma', () => ({ default: prismaMock }));

import { requireLiveWrite } from '../src/middleware/plan';

type PrismaMock = {
  subscription: { findUnique: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn> };
};

const db = prismaMock as unknown as PrismaMock;

function storeReq(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    store: { id: 'store-1', role: 'OWNER', isOwner: true, canManageAll: true },
    user: { id: 'user-1', email: 'owner@madastock.mg' },
    ...overrides,
  } as unknown as Request;
}

const expiredSubscription = {
  status: 'EXPIRED',
  currentPeriodEnd: new Date('2026-01-01T00:00:00.000Z'),
  trialEndsAt: new Date('2026-01-01T00:00:00.000Z'),
  plan: { featuresJson: '{}' },
  store: { billingExempt: false },
};

beforeEach(() => {
  vi.clearAllMocks();
  db.subscription.findUnique.mockResolvedValue(expiredSubscription);
  db.user.findUnique.mockResolvedValue({ isSuperAdmin: false, isActive: true, deletedAt: null });
});

const run = (req: Request) => {
  const next = vi.fn() as unknown as NextFunction;
  return requireLiveWrite(req, {} as Response, next).then(() => next);
};

describe('Contrôle d\'abonnement en écriture', () => {
  it('refuse en 402 un membre d\'une boutique expirée', async () => {
    const next = await run(storeReq());
    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0] as { statusCode?: number };
    expect(error.statusCode).toBe(402);
  });

  it('laisse passer le super administrateur de la plateforme', async () => {
    db.user.findUnique.mockResolvedValue({ isSuperAdmin: true, isActive: true, deletedAt: null });
    const next = await run(storeReq());
    expect(next).toHaveBeenCalledWith();
    expect(db.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' }, select: expect.any(Object) }),
    );
  });

  it('ne laisse pas passer un super administrateur désactivé ou supprimé', async () => {
    db.user.findUnique.mockResolvedValue({ isSuperAdmin: true, isActive: false, deletedAt: null });
    const next = await run(storeReq());
    expect((next.mock.calls[0][0] as { statusCode?: number }).statusCode).toBe(402);
  });

  it('ne consulte pas la base pour laisser passer une boutique à jour', async () => {
    db.subscription.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      currentPeriodEnd: new Date('2099-01-01T00:00:00.000Z'),
      trialEndsAt: null,
      plan: { featuresJson: '{}' },
      store: { billingExempt: false },
    });
    const next = await run(storeReq());
    expect(next).toHaveBeenCalledWith();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it('laisse toujours passer les lectures', async () => {
    const next = await run(storeReq({ method: 'GET' } as Partial<Request>));
    expect(next).toHaveBeenCalledWith();
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});
