import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import app from '../src/app';
import * as subscriptionService from '../src/services/subscription.service';
import * as schedulerService from '../src/services/scheduler.service';
import * as notificationService from '../src/services/notification.service';

const DAY = 24 * 60 * 60 * 1000;

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
  stock: { findMany: vi.fn() },
  reminder: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../src/lib/prisma', () => ({ default: prismaMock }));

const membership = {
  role: 'OWNER' as const,
  isOwner: true,
  canManageAll: true,
  store: { id: 'store-1', active: true },
};

async function authAgent() {
  prismaMock.user.findUnique.mockResolvedValue(mockUser);
  prismaMock.storeMember.findUnique.mockResolvedValue(membership);
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'owner@madastock.mg', password: 'password123' });
  const token = res.body.token as string;
  return {
    token,
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`).set('X-Store-Id', 'store-1'),
    patch: (url: string, body?: unknown) => request(app).patch(url).set('Authorization', `Bearer ${token}`).set('X-Store-Id', 'store-1').send(body ?? {}),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`).set('X-Store-Id', 'store-1'),
  };
}

const plan = {
  id: 'plan-pro',
  name: 'PRO',
  slug: 'pro',
  priceAr: 120000,
  durationDays: 30,
  durationMonths: 1,
  billingCycle: 'MONTHLY',
  isActive: true,
};

function sub(overrides: Record<string, any> = {}) {
  return {
    id: 'sub-1',
    storeId: 'store-1',
    planId: 'plan-pro',
    status: 'ACTIVE',
    trialEndsAt: null,
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(),
    priceAr: 120000,
    billingCycle: 'MONTHLY',
    autoRenew: true,
    cancelledAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    plan,
    ...overrides,
  };
}

const notification = {
  id: 'notif-1',
  storeId: 'store-1',
  userId: 'user-owner',
  type: 'SUBSCRIPTION_EXPIRING',
  title: 'Votre abonnement expire dans 1 jour(s)',
  message: 'Abonnement PRO : fin le 20/10/2026.',
  dataJson: JSON.stringify({ daysLeft: 1, to: '/billing' }),
  isRead: false,
  readAt: null,
  createdAt: new Date('2026-09-25T08:00:00.000Z'),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  prismaMock.storeMember.findMany.mockResolvedValue([{ userId: 'user-owner' }]);
  prismaMock.notification.count.mockResolvedValue(0);
  prismaMock.notification.findMany.mockResolvedValue([notification]);
});

describe('Abonnement : compte à rebours en jours', () => {
  it('daysLeft compte les jours restants (J-30 puis J-1 puis 0)', () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    expect(subscriptionService.daysLeft(new Date(now.getTime() + 30 * DAY), now)).toBe(30);
    expect(subscriptionService.daysLeft(new Date(now.getTime() + 1 * DAY + 60 * 60 * 1000), now)).toBe(1);
    expect(subscriptionService.daysLeft(new Date(now.getTime() + 5 * 60 * 1000), now)).toBe(0);
    expect(subscriptionService.daysLeft(new Date(now.getTime() - DAY), now)).toBe(0);
  });

  it('planDurationDays lit durationDays, sinon 30', () => {
    expect(subscriptionService.planDurationDays({ durationDays: 90 } as any)).toBe(90);
    expect(subscriptionService.planDurationDays({ durationDays: 0 } as any)).toBe(30);
  });

  it('nextPeriod démarre maintenant sur un abonnement vide ou expiré', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');
    const period = subscriptionService.nextPeriod(plan as any, null, now);
    expect(period.start.toISOString()).toBe(now.toISOString());
    expect(period.end.toISOString()).toBe(new Date(now.getTime() + 30 * DAY).toISOString());
    expect(period.renewed).toBe(false);
  });

  it('nextPeriod empile les jours restants (rien ne se perd)', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');
    const remainingDays = 12;
    const existing = sub({ currentPeriodEnd: new Date(now.getTime() + remainingDays * DAY) });
    const period = subscriptionService.nextPeriod(plan as any, existing as any, now);
    expect(period.renewed).toBe(true);
    expect(period.remainingDays).toBe(remainingDays);
    expect(period.end.getTime() - now.getTime()).toBe((remainingDays + 30) * DAY);
  });

  it('essai gratuit = 14 jours, currentPeriodEnd aligné sur trialEndsAt', () => {
    const now = new Date('2026-10-01T00:00:00.000Z');
    const trial = subscriptionService.trialPeriod(now);
    expect(trial.end.toISOString()).toBe(new Date(now.getTime() + 14 * DAY).toISOString());
    expect(trial.start.toISOString()).toBe(now.toISOString());
  });

  it('getSubscriptionState renvoie status + jours + avancement', async () => {
    const end = new Date(Date.now() + 10 * DAY);
    prismaMock.subscription.findUnique.mockResolvedValue(
      sub({ currentPeriodStart: new Date(Date.now() - 20 * DAY), currentPeriodEnd: end }),
    );

    const state = await subscriptionService.getSubscriptionState('store-1');
    expect(state?.status).toBe('ACTIVE');
    expect(state?.daysRemaining).toBe(10);
    expect(state?.daysTotal).toBe(30);
    expect(state?.isLive).toBe(true);
    expect(state?.remainingPercent).toBeCloseTo(33, 0);
    expect(state?.planName).toBe('PRO');
  });

  it('getSubscriptionState bascule en EXPIRED quand la date est passée (sans cron)', async () => {
    prismaMock.subscription.findUnique.mockResolvedValue(
      sub({ currentPeriodEnd: new Date(Date.now() - 2 * DAY) }),
    );
    const state = await subscriptionService.getSubscriptionState('store-1');
    expect(state?.status).toBe('EXPIRED');
    expect(state?.daysRemaining).toBe(0);
    expect(state?.isLive).toBe(false);
  });

  it('expireDueSubscriptions passe en EXPIRED et renvoie les boutique concernées', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([{ id: 'sub-1', storeId: 'store-1' }]);
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });

    const storeIds = await subscriptionService.expireDueSubscriptions();
    expect(storeIds).toEqual(['store-1']);
    expect(prismaMock.subscription.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['sub-1'] } },
      data: { status: 'EXPIRED' },
    });
  });

  it('subscriptionsWithDaysLeft cible la fenêtre J-n exacte', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    await subscriptionService.subscriptionsWithDaysLeft(3);
    const now = Date.now();
    const where = prismaMock.subscription.findMany.mock.calls[0][0].where;
    const range = where.currentPeriodEnd;
    expect(where.status).toEqual({ in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] });
    expect(range.gt.getTime()).toBeGreaterThanOrEqual(now + 2 * DAY - 5000);
    expect(range.lte.getTime()).toBeLessThanOrEqual(now + 3 * DAY + 5000);
  });
});

describe('Notifications', () => {
  it('notifyOwners notifie propriétaire et gestionnaire, une fois chacun', async () => {
    prismaMock.storeMember.findMany.mockResolvedValue([{ userId: 'user-owner' }, { userId: 'user-admin' }]);

    const created = await notificationService.notifyOwners({
      storeId: 'store-1',
      type: 'SUBSCRIPTION_ACTIVATED',
      title: 'Abonnement activé',
      message: 'Merci !',
    });

    expect(created).toBe(2);
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ userId: 'user-owner', type: 'SUBSCRIPTION_ACTIVATED' }),
        expect.objectContaining({ userId: 'user-admin', type: 'SUBSCRIPTION_ACTIVATED' }),
      ],
    });
  });

  it('notifyOwners ne duplique pas si une notification du jour existe déjà', async () => {
    prismaMock.storeMember.findMany.mockResolvedValue([{ userId: 'user-owner' }]);
    prismaMock.notification.count.mockResolvedValue(1);

    const created = await notificationService.notifyOwners({
      storeId: 'store-1',
      type: 'LOW_STOCK',
      title: 'Stock bas',
      message: 'Riz',
      since: new Date(),
    });

    expect(created).toBe(0);
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
  });

  it('notifyOwners ne casse jamais l\'action métier (silencieux)', async () => {
    prismaMock.storeMember.findMany.mockRejectedValue(new Error('boom'));
    const created = await notificationService.notifyOwners({
      storeId: 'store-1',
      type: 'LOW_STOCK',
      title: 'Stock bas',
      message: 'Riz',
    });
    expect(created).toBe(0);
  });

  it('GET /notifications : liste paginée + compteur non lus', async () => {
    prismaMock.notification.count.mockResolvedValueOnce(7).mockResolvedValueOnce(3);
    const agent = await authAgent();

    const res = await agent.get('/api/v1/notifications');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].data).toEqual({ daysLeft: 1, to: '/billing' });
    expect(res.body.unreadCount).toBe(3);
    expect(res.body.pagination).toEqual({ page: 1, limit: 15, total: 7, pages: 1 });
  });

  it('GET /notifications/unread : badge de la cloche', async () => {
    prismaMock.notification.count.mockResolvedValue(5);
    const agent = await authAgent();
    const res = await agent.get('/api/v1/notifications/unread');
    expect(res.status).toBe(200);
    expect(res.body.unreadCount).toBe(5);
  });

  it('PATCH /notifications/:id/read : marque comme lu', async () => {
    prismaMock.notification.findFirst = vi.fn().mockResolvedValue(notification);
    prismaMock.notification.update.mockResolvedValue({ ...notification, isRead: true, readAt: new Date() });
    const agent = await authAgent();

    const res = await agent.patch('/api/v1/notifications/notif-1/read');

    expect(res.status).toBe(200);
    expect(res.body.isRead).toBe(true);
    expect(prismaMock.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'notif-1' }, data: expect.objectContaining({ isRead: true }) }),
    );
  });

  it('PATCH /notifications/read-all : tout marquer lu', async () => {
    prismaMock.notification.updateMany.mockResolvedValue({ count: 4 });
    const agent = await authAgent();
    const res = await agent.patch('/api/v1/notifications/read-all');
    expect(res.status).toBe(200);
    expect(res.body.updated).toBe(4);
  });

  it('refuse les notifications d\'une autre boutique', async () => {
    prismaMock.notification.findFirst = vi.fn().mockResolvedValue(null);
    const agent = await authAgent();
    const res = await agent.patch('/api/v1/notifications/autre/read');
    expect(res.status).toBe(404);
  });

  it('DELETE /notifications/:id : 204', async () => {
    prismaMock.notification.findFirst = vi.fn().mockResolvedValue(notification);
    prismaMock.notification.delete.mockResolvedValue({});
    const agent = await authAgent();
    const res = await agent.delete('/api/v1/notifications/notif-1');
    expect(res.status).toBe(204);
  });

  it('exige une session et une boutique', async () => {
    const res = await request(app).get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });
});

describe('Tâches quotidiennes (scheduler)', () => {
  it('envoie une alerte J-3 puis J-1 sans doublon', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([
      {
        id: 'sub-1',
        storeId: 'store-1',
        status: 'ACTIVE',
        currentPeriodEnd: new Date(Date.now() + 3 * DAY),
        planId: 'plan-pro',
        plan,
        store: { id: 'store-1', name: 'Boutique Mada' },
      },
    ]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 1 });

    await schedulerService.runDailyJobs();

    const call = prismaMock.notification.createMany.mock.calls[0][0].data[0];
    expect(call.type).toBe('SUBSCRIPTION_EXPIRING');
    expect(call.title).toContain('3 jour');
    expect(call.storeId).toBe('store-1');
  });

  it('prévient quand l\'abonnement vient d\'arriver à terme', async () => {
    // Alertes J-3 / J-1 (avec include) : rien. Expiration (sans include) : une ligne en retard.
    prismaMock.subscription.findMany.mockImplementation((args: any) =>
      args?.include ? Promise.resolve([]) : Promise.resolve([{ id: 'sub-1', storeId: 'store-1' }]),
    );
    prismaMock.subscription.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.store.findMany.mockResolvedValue([{ id: 'store-1', name: 'Boutique Mada' }]);
    prismaMock.notification.createMany.mockResolvedValue({ count: 1 });

    await schedulerService.runDailyJobs();

    const created = prismaMock.notification.createMany.mock.calls.flatMap((c) => c[0].data as any[]);
    const expired = created.find((n) => n.type === 'SUBSCRIPTION_EXPIRED');
    expect(expired).toBeDefined();
    expect(expired.title).toBe('Abonnement expiré');
  });

  it('alerte le stock bas en s\'appuyant sur le seuil du produit', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.stock.findMany.mockResolvedValue([
      {
        storeId: 'store-1',
        quantityAr: 2,
        isShared: false,
        product: { id: 'p-1', name: 'Riz 5kg', trackStock: true, lowStockThreshold: 5 },
      },
      {
        storeId: 'store-1',
        quantityAr: 90,
        isShared: false,
        product: { id: 'p-2', name: 'Huile', trackStock: true, lowStockThreshold: 5 },
      },
    ]);

    await schedulerService.runDailyJobs();

    const created = prismaMock.notification.createMany.mock.calls.flatMap((c) => c[0].data as any[]);
    const low = created.filter((n) => n.type === 'LOW_STOCK');
    expect(low).toHaveLength(1);
    expect(low[0].title).toContain('Riz 5kg');
  });

  it('rappelle les rappels CRM du jour', async () => {
    prismaMock.subscription.findMany.mockResolvedValue([]);
    prismaMock.stock.findMany.mockResolvedValue([]);
    prismaMock.reminder.findMany.mockResolvedValue([
      { id: 'rem-1', storeId: 'store-1', title: 'Relancer Rakoto', message: 'Appel à faire', customer: { firstName: 'Rakoto', lastName: 'R' } },
    ]);

    await schedulerService.runDailyJobs();

    const created = prismaMock.notification.createMany.mock.calls.flatMap((c) => c[0].data as any[]);
    expect(created.some((n) => n.type === 'REMINDER_DUE' && n.title === 'Relancer Rakoto')).toBe(true);
  });
});
