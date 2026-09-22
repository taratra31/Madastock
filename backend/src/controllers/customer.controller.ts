import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as customerService from '../services/customer.service';

export const listCustomers = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await customerService.listCustomers(req.store.id, {
    search: req.query.search as string | undefined,
    vipOnly: req.query.vipOnly === 'true',
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getCustomerStats = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const stats = await customerService.getCustomerStats(req.store.id);
  res.json(stats);
});

export const getCustomer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const customer = await customerService.getCustomer(req.store.id, req.params.customerId);
  res.json(customer);
});

export const createCustomer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const customer = await customerService.createCustomer(req.store.id, req.body);
  res.status(201).json(customer);
});

export const updateCustomer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const customer = await customerService.updateCustomer(req.store.id, req.params.customerId, req.body);
  res.json(customer);
});

export const deleteCustomer = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await customerService.deleteCustomer(req.store.id, req.params.customerId);
  res.status(204).end();
});