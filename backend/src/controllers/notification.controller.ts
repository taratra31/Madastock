import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as notificationService from '../services/notification.service';

function ctx(req: Request) {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  return { storeId: req.store.id, userId: req.user.id };
}

export const list = asyncHandler(async (req: Request, res: Response) => {
  const { storeId, userId } = ctx(req);
  res.json(
    await notificationService.listNotifications(userId, storeId, {
      onlyUnread: req.query.unread === 'true',
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
  );
});

export const unread = asyncHandler(async (req: Request, res: Response) => {
  const { storeId, userId } = ctx(req);
  res.json(await notificationService.countUnread(userId, storeId));
});

export const read = asyncHandler(async (req: Request, res: Response) => {
  const { storeId, userId } = ctx(req);
  res.json(await notificationService.markRead(userId, storeId, req.params.notificationId));
});

export const readAll = asyncHandler(async (req: Request, res: Response) => {
  const { storeId, userId } = ctx(req);
  res.json(await notificationService.markAllRead(userId, storeId));
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const { storeId, userId } = ctx(req);
  await notificationService.removeNotification(userId, storeId, req.params.notificationId);
  res.status(204).end();
});
