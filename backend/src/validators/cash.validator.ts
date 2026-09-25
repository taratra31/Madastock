import { z } from 'zod';
import { PAYMENT_METHODS } from './supply.validator';

export const openSessionSchema = z.object({
  openingBalanceAr: z.coerce.number().min(0, 'Le montant de départ ne peut pas être négatif').default(0),
  notes: z.string().trim().max(500).optional(),
});

export const closeSessionSchema = z.object({
  closingBalanceAr: z.coerce.number().min(0, 'Le montant de clôture ne peut pas être négatif'),
  notes: z.string().trim().max(500).optional(),
});

export const cashTransactionSchema = z.object({
  transactionType: z.enum(['DEPOSIT', 'WITHDRAWAL', 'ADJUSTMENT']),
  amountAr: z.coerce.number().positive('Le montant doit être supérieur à 0'),
  method: z.enum(PAYMENT_METHODS).default('CASH'),
  description: z.string().trim().max(500).optional(),
});

export type OpenSessionInput = z.infer<typeof openSessionSchema>;
export type CloseSessionInput = z.infer<typeof closeSessionSchema>;
export type CashTransactionInput = z.infer<typeof cashTransactionSchema>;
