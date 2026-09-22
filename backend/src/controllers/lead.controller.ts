import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as leadService from '../services/lead.service';

export const listLeads = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await leadService.listLeads(req.store.id, {
    status: req.query.status as string | undefined,
    search: req.query.search as string | undefined,
    assignedToId: req.query.assignedToId as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getLeadFunnel = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const funnel = await leadService.getLeadFunnel(req.store.id);
  res.json(funnel);
});

export const getLead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const lead = await leadService.getLead(req.store.id, req.params.leadId);
  res.json(lead);
});

export const createLead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const lead = await leadService.createLead(req.store.id, req.body);
  res.status(201).json(lead);
});

export const updateLead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const lead = await leadService.updateLead(req.store.id, req.params.leadId, req.body);
  res.json(lead);
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const lead = await leadService.setLeadStatus(req.store.id, req.params.leadId, req.body.status);
  res.json(lead);
});

export const convertLead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const lead = await leadService.convertLead(req.store.id, req.params.leadId);
  res.json(lead);
});

export const deleteLead = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await leadService.deleteLead(req.store.id, req.params.leadId);
  res.status(204).end();
});