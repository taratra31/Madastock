import { z } from 'zod';

export const SUBSCRIPTION_STATUSES = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'EXPIRED'] as const;

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional(),
  status: z.string().trim().max(50).optional(),
  sector: z.string().trim().max(50).optional(),
  planId: z.string().trim().max(64).optional(),
  storeId: z.string().trim().max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export const updateStoreStatusSchema = z.object({
  active: z.boolean(),
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean(),
});

export const updateSubscriptionSchema = z
  .object({
    status: z.enum(SUBSCRIPTION_STATUSES).optional(),
    planId: z.string().trim().min(1).max(64).optional(),
    autoRenew: z.boolean().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.planId !== undefined || v.autoRenew !== undefined,
    { message: 'Aucune modification fournie' }
  );

export type ListQueryInput = z.infer<typeof listQuerySchema>;
export type UpdateStoreStatusInput = z.infer<typeof updateStoreStatusSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;