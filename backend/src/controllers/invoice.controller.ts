import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as invoiceService from '../services/invoice.service';

export const listInvoices = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await invoiceService.listInvoices(req.store.id, {
    docType: req.query.docType as string | undefined,
    status: req.query.status as string | undefined,
    customerId: req.query.customerId as string | undefined,
    workOrderId: req.query.workOrderId as string | undefined,
    search: req.query.search as string | undefined,
    from: req.query.from as string | undefined,
    to: req.query.to as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const invoice = await invoiceService.getInvoice(req.store.id, req.params.invoiceId);
  res.json(invoice);
});

export const createInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const invoice = await invoiceService.createInvoice(req.store.id, req.user.id, req.body);
  res.status(201).json(invoice);
});

export const updateInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const invoice = await invoiceService.updateInvoice(req.store.id, req.params.invoiceId, req.body);
  res.json(invoice);
});

export const changeStatus = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const invoice = await invoiceService.setInvoiceStatus(req.store.id, req.params.invoiceId, req.body.status);
  res.json(invoice);
});

export const acceptAndInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store || !req.user) throw badRequest('Contexte boutique manquant');
  const invoice = await invoiceService.acceptQuoteAndCreateInvoice(req.store.id, req.user.id, req.params.invoiceId);
  res.json(invoice);
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const invoice = await invoiceService.recordPayment(req.store.id, req.params.invoiceId, req.body);
  res.json(invoice);
});

export const deleteInvoice = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await invoiceService.deleteInvoice(req.store.id, req.params.invoiceId);
  res.status(204).end();
});