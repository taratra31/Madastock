import { z } from 'zod';

// --- Fournisseurs -------------------------------------------------------
export const supplierInputSchema = z.object({
  name: z.string().trim().min(1, 'Le nom est obligatoire').max(255),
  contactName: z.string().trim().max(255).optional(),
  phone: z.string().trim().max(30).optional(),
  email: z.string().trim().email('Email invalide').max(255).optional(),
  address: z.string().trim().max(500).optional(),
  tinNumber: z.string().trim().max(60).optional(),
  notes: z.string().trim().max(2000).optional(),
  isActive: z.boolean().optional(),
});
export const supplierUpdateSchema = supplierInputSchema.partial();

// --- Marques -----------------------------------------------------------
export const brandInputSchema = z.object({
  name: z.string().trim().min(1, 'Le nom de la marque est obligatoire').max(120),
  logoUrl: z.string().trim().url('URL de logo invalide').max(500).optional().or(z.literal('')),
  description: z.string().trim().max(1000).optional(),
  isActive: z.boolean().optional(),
});
export const brandUpdateSchema = brandInputSchema.partial();

// --- Achats ------------------------------------------------------------
export const PURCHASE_STATUSES = ['ORDERED', 'RECEIVED', 'CANCELLED'] as const;

export const purchaseItemSchema = z.object({
  productId: z.string().trim().min(1, 'Produit requis'),
  variantId: z.string().trim().min(1).optional(),
  quantity: z.coerce.number().positive('La quantité doit être supérieure à 0'),
  unitCostAr: z.coerce.number().min(0, 'Le prix d\'achat ne peut pas être négatif'),
  discountAr: z.coerce.number().min(0).default(0),
  taxAr: z.coerce.number().min(0).default(0),
});

export const purchaseInputSchema = z.object({
  supplierId: z.string().trim().min(1).optional(),
  warehouseId: z.string().trim().min(1, "L'entrepôt est requis"),
  items: z.array(purchaseItemSchema).min(1, 'Ajoutez au moins un article'),
  discountAr: z.coerce.number().min(0).default(0),
  taxAr: z.coerce.number().min(0).default(0),
  shippingAr: z.coerce.number().min(0).default(0),
  amountPaidAr: z.coerce.number().min(0).default(0),
  expectedAt: z.string().trim().min(1).optional(),
  receivedAt: z.string().trim().min(1).optional(),
  notes: z.string().trim().max(2000).optional(),
  status: z.enum(['ORDERED', 'RECEIVED']).default('ORDERED'),
  // Met à jour le prix d'achat du produit (utile pour la marge).
  updateCostPrice: z.boolean().default(true),
});

export const purchaseStatusSchema = z.object({
  status: z.enum(PURCHASE_STATUSES),
});

// --- Dépenses ----------------------------------------------------------
export const EXPENSE_CATEGORIES = [
  'RENT',
  'SALARY',
  'TRANSPORT',
  'UTILITIES',
  'SUPPLIES',
  'MAINTENANCE',
  'MARKETING',
  'TAXES',
  'BANK_FEES',
  'OTHER',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CARD', 'OTHER'] as const;

export const expenseInputSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES),
  description: z.string().trim().max(500).optional(),
  amountAr: z.coerce.number().positive('Le montant doit être supérieur à 0'),
  incurredAt: z.string().trim().min(1).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).default('CASH'),
  receiptUrl: z.string().trim().url('URL invalide').max(500).optional().or(z.literal('')),
});
export const expenseUpdateSchema = z.object({
  category: z.enum(EXPENSE_CATEGORIES).optional(),
  description: z.string().trim().max(500).optional(),
  amountAr: z.coerce.number().positive('Le montant doit être supérieur à 0').optional(),
  incurredAt: z.string().trim().min(1).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional(),
  receiptUrl: z.string().trim().url('URL invalide').max(500).optional().or(z.literal('')),
});

export type SupplierInput = z.infer<typeof supplierInputSchema>;
export type BrandInput = z.infer<typeof brandInputSchema>;
export type PurchaseInput = z.infer<typeof purchaseInputSchema>;
export type ExpenseInput = z.infer<typeof expenseInputSchema>;
