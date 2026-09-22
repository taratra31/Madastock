import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as reminderService from '../services/reminder.service';

export const listReminders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await reminderService.listReminders(req.store.id, {
    status: req.query.status as string | undefined,
    type: req.query.type as string | undefined,
    upcoming: req.query.upcoming === 'true',
  });
  res.json(result);
});

export const createReminder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const reminder = await reminderService.createReminder(req.store.id, req.body);
  res.status(201).json(reminder);
});

export const updateReminder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const reminder = await reminderService.updateReminder(req.store.id, req.params.reminderId, req.body);
  res.json(reminder);
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const reminder = await reminderService.setReminderStatus(req.store.id, req.params.reminderId, req.body.status);
  res.json(reminder);
});

export const deleteReminder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await reminderService.deleteReminder(req.store.id, req.params.reminderId);
  res.status(204).end();
});