import prisma from '../lib/prisma';
import { notFound } from '../utils/httpError';

export type NotificationType =
  | 'SUBSCRIPTION_ACTIVATED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_EXPIRING'
  | 'SUBSCRIPTION_EXPIRED'
  | 'PAYMENT_FAILED'
  | 'LOW_STOCK'
  | 'REMINDER_DUE';

export interface NotifyInput {
  storeId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  /** Ne pas dupliquer si une notification du même type existe depuis `since`. */
  since?: Date;
}

function serialize(n: any) {
  let data: unknown = null;
  if (n.dataJson) {
    try {
      data = JSON.parse(n.dataJson);
    } catch {
      data = null;
    }
  }
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    data,
    isRead: n.isRead,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}

/**
 * Crée une notification pour chaque membre propriétaire/manager de la boutique.
 * Silencieux : une notification ne doit jamais faire échouer l'action métier
 * qui l'a déclenchée.
 */
export async function notifyOwners(input: NotifyInput): Promise<number> {
  try {
    const members = await prisma.storeMember.findMany({
      where: { storeId: input.storeId, role: { in: ['OWNER', 'ADMIN', 'MANAGER'] } },
      select: { userId: true },
    });
    if (members.length === 0) return 0;

    if (input.since) {
      const already = await prisma.notification.count({
        where: {
          storeId: input.storeId,
          type: input.type,
          createdAt: { gte: input.since },
        },
      });
      if (already > 0) return 0;
    }

    await prisma.notification.createMany({
      data: members.map((m) => ({
        storeId: input.storeId,
        userId: m.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        dataJson: input.data ? JSON.stringify(input.data) : null,
      })),
    });
    return members.length;
  } catch (error) {
    console.warn('[NOTIFY] échec création notification :', (error as Error).message);
    return 0;
  }
}

/** Notifie un membre précis (vendeur qui encaisse, par exemple). */
export async function notifyUser(args: {
  storeId: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        storeId: args.storeId,
        userId: args.userId,
        type: args.type,
        title: args.title,
        message: args.message,
        dataJson: args.data ? JSON.stringify(args.data) : null,
      },
    });
  } catch (error) {
    console.warn('[NOTIFY] échec création notification :', (error as Error).message);
  }
}

export interface ListQuery {
  onlyUnread?: boolean;
  limit?: number;
  page?: number;
}

export async function listNotifications(userId: string, storeId: string, query: ListQuery = {}) {
  const page = Math.max(1, Number(query.page ?? 1));
  const limit = Math.min(50, Math.max(1, Number(query.limit ?? 15)));
  const where: Record<string, any> = { userId, storeId };
  if (query.onlyUnread) where.isRead = false;

  const [data, total, unread] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId, storeId, isRead: false } }),
  ]);

  return {
    data: data.map(serialize),
    unreadCount: unread,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function countUnread(userId: string, storeId: string) {
  const unreadCount = await prisma.notification.count({ where: { userId, storeId, isRead: false } });
  return { unreadCount };
}

export async function markRead(userId: string, storeId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, userId, storeId } });
  if (!notification) throw notFound('Notification introuvable');
  if (notification.isRead) return serialize(notification);
  const updated = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true, readAt: new Date() },
  });
  return serialize(updated);
}

export async function markAllRead(userId: string, storeId: string) {
  const { count } = await prisma.notification.updateMany({
    where: { userId, storeId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  return { success: true, updated: count };
}

export async function removeNotification(userId: string, storeId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, userId, storeId } });
  if (!notification) throw notFound('Notification introuvable');
  await prisma.notification.delete({ where: { id: notification.id } });
  return { success: true };
}
