import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as workOrderService from '../services/workOrder.service';

export const listWorkOrders = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await workOrderService.listWorkOrders(req.store.id, {
    status: req.query.status as string | undefined,
    mechanicId: req.query.mechanicId as string | undefined,
    vehicleId: req.query.vehicleId as string | undefined,
    customerId: req.query.customerId as string | undefined,
    search: req.query.search as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const workOrder = await workOrderService.getWorkOrder(req.store.id, req.params.workOrderId);
  res.json(workOrder);
});

export const createWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const workOrder = await workOrderService.createWorkOrder(req.store.id, req.user.id, req.body);
  res.status(201).json(workOrder);
});

export const updateWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const workOrder = await workOrderService.updateWorkOrder(req.store.id, req.params.workOrderId, req.body);
  res.json(workOrder);
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const workOrder = await workOrderService.changeWorkOrderStatus(req.store.id, req.params.workOrderId, req.body);
  res.json(workOrder);
});

export const deleteWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await workOrderService.deleteWorkOrder(req.store.id, req.params.workOrderId);
  res.status(204).end();
});