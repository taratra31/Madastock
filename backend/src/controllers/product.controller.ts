import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as productService from '../services/product.service';

export const listProducts = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const result = await productService.listProducts(req.store.id, {
    search: req.query.search as string | undefined,
    categoryId: req.query.categoryId as string | undefined,
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json(result);
});

export const getProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const product = await productService.getProduct(req.store.id, req.params.productId);
  res.json(product);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const product = await productService.createProduct(req.store.id, req.body);
  res.status(201).json(product);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const product = await productService.updateProduct(req.store.id, req.params.productId, req.body);
  res.json(product);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await productService.deleteProduct(req.store.id, req.params.productId);
  res.status(204).end();
});
