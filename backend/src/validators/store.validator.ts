import { z } from 'zod';

export const createStoreSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est requis').max(255),
  description: z.string().trim().max(1000).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(3).default('MG'),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Email invalide').max(255).optional(),
  currency: z.string().trim().max(3).default('MGA'),
});

export const updateStoreSchema = z.object({
  name: z.string().trim().min(1).max(255).optional(),
  description: z.string().trim().max(1000).optional(),
  address: z.string().trim().max(500).optional(),
  city: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Email invalide').max(255).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email invalide'),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'STOCK_MANAGER', 'ACCOUNTANT']).default('MANAGER'),
});

export const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER', 'STOCK_MANAGER', 'ACCOUNTANT']),
});

export type CreateStoreInput = z.infer<typeof createStoreSchema>;
export type UpdateStoreInput = z.infer<typeof updateStoreSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;
