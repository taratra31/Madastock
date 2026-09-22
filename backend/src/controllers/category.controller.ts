import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { badRequest } from '../utils/httpError';
import * as categoryService from '../services/category.service';

export const listCategories = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const categories = await categoryService.listCategories(req.store.id, req.query.activeOnly === 'true');
  res.json(categories);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const category = await categoryService.createCategory(req.store.id, req.body);
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  const category = await categoryService.updateCategory(req.store.id, req.params.categoryId, req.body);
  res.json(category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  if (!req.store) throw badRequest('Contexte boutique manquant');
  await categoryService.deleteCategory(req.store.id, req.params.categoryId);
  res.status(204).end();
});