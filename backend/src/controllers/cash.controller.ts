import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as cashService from '../services/cash.service';
import {
  cashTransactionSchema,
  closeSessionSchema,
  openSessionSchema,
} from '../validators/cash.validator';

function parse<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: { issues: { message: string }[] } } }, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw badRequest(parsed.error?.issues[0]?.message ?? 'Données invalides');
  return parsed.data as T;
}

export const getCurrent = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const session = await cashService.getOpenSession(req.store.id);
  if (!session) {
    res.json({ open: false, session: null });
    return;
  }
  res.json({ open: true, session });
});

export const openSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const input = parse(openSessionSchema, req.body);
  res.status(201).json(await cashService.openSession(req.store.id, req.user.id, input));
});

export const closeSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const input = parse(closeSessionSchema, req.body);
  res.json(await cashService.closeSession(req.store.id, req.user.id, input));
});

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  res.json(
    await cashService.listSessions(req.store.id, {
      status: req.query.status as string | undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
    }),
  );
});

export const getSession = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  res.json(await cashService.getSessionDetail(req.store.id, req.params.sessionId));
});

export const addTransaction = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const input = parse(cashTransactionSchema, req.body);
  res.status(201).json(await cashService.addTransaction(req.store.id, req.user.id, input));
});
