// ============================================================
// HABILITATIONS (RBAC)
// Une permission = une action sur un module. Le rôle du membre de
// la boutique détermine la liste. Le propriétaire (isOwner) a TOUT.
//
// Règle : une restriction ne doit JAMAIS reposer sur le frontend
// (un bouton caché n'est pas une sécurité). Chaque route écrit
// applique `requirePermission(...)` côté serveur.
// ============================================================

export const PERMISSIONS = {
  // Tableau de bord & rapports
  DASHBOARD_READ: 'dashboard.read',
  REPORT_READ: 'report.read',
  // Catalogue
  PRODUCT_READ: 'product.read',
  PRODUCT_WRITE: 'product.write',
  PRODUCT_DELETE: 'product.delete',
  /** Voir les prix d'achat / marges (réservé : caissier NE VOIT PAS les coûts). */
  COST_VIEW: 'cost.view',
  CATEGORY_WRITE: 'category.write',
  BRAND_WRITE: 'brand.write',
  // Stock
  STOCK_READ: 'stock.read',
  STOCK_WRITE: 'stock.write',
  WAREHOUSE_MANAGE: 'warehouse.manage',
  // Ventes
  SALE_READ: 'sale.read',
  SALE_CREATE: 'sale.create',
  SALE_CANCEL: 'sale.cancel',
  // Clients
  CUSTOMER_READ: 'customer.read',
  CUSTOMER_WRITE: 'customer.write',
  CUSTOMER_DELETE: 'customer.delete',
  // Fournisseurs & achats
  SUPPLIER_READ: 'supplier.read',
  SUPPLIER_WRITE: 'supplier.write',
  PURCHASE_READ: 'purchase.read',
  PURCHASE_WRITE: 'purchase.write',
  PURCHASE_RECEIVE: 'purchase.receive',
  // Facturation
  INVOICE_READ: 'invoice.read',
  INVOICE_WRITE: 'invoice.write',
  INVOICE_DELETE: 'invoice.delete',
  // Dépenses & caisse
  EXPENSE_READ: 'expense.read',
  EXPENSE_WRITE: 'expense.write',
  CASH_READ: 'cash.read',
  CASH_WRITE: 'cash.write',
  // CRM (garage / leads / rappels)
  CRM_READ: 'crm.read',
  CRM_WRITE: 'crm.write',
  // Paramètres & équipe
  SETTINGS_WRITE: 'settings.write',
  MEMBER_MANAGE: 'member.manage',
  // Abonnement
  BILLING_READ: 'billing.read',
  BILLING_WRITE: 'billing.write',
  // Divers
  NOTIFICATION_READ: 'notification.read',
  AI_USE: 'ai.use',
  DATA_EXPORT: 'data.export',
  DATA_IMPORT: 'data.import',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const P = PERMISSIONS;

/** Toutes les permissions d'exploitation (tout sauf abonnement / équipe / facturation destructive). */
const OPERATIONAL: Permission[] = [
  P.DASHBOARD_READ,
  P.REPORT_READ,
  P.PRODUCT_READ,
  P.PRODUCT_WRITE,
  P.PRODUCT_DELETE,
  P.COST_VIEW,
  P.CATEGORY_WRITE,
  P.BRAND_WRITE,
  P.STOCK_READ,
  P.STOCK_WRITE,
  P.WAREHOUSE_MANAGE,
  P.SALE_READ,
  P.SALE_CREATE,
  P.SALE_CANCEL,
  P.CUSTOMER_READ,
  P.CUSTOMER_WRITE,
  P.CUSTOMER_DELETE,
  P.SUPPLIER_READ,
  P.SUPPLIER_WRITE,
  P.PURCHASE_READ,
  P.PURCHASE_WRITE,
  P.PURCHASE_RECEIVE,
  P.INVOICE_READ,
  P.INVOICE_WRITE,
  P.EXPENSE_READ,
  P.EXPENSE_WRITE,
  P.CASH_READ,
  P.CASH_WRITE,
  P.CRM_READ,
  P.CRM_WRITE,
  P.SETTINGS_WRITE,
  P.NOTIFICATION_READ,
  P.AI_USE,
  P.DATA_EXPORT,
  P.DATA_IMPORT,
];

/**
 * Matrice rôle → permissions.
 * - ADMIN      : contrôle total de la boutique (sauf payer l'abonnement).
 * - MANAGER    : exploitation complète, sans réglages ni équipe ni suppression de factures.
 * - STOCK_MANAGER : produits + stock + réceptions, aucune vente, aucune caisse.
 * - ACCOUNTANT : lecture produits/coûts, ventes, factures, dépenses, caisse, rapports.
 * - CASHIER    : encaissement + clients, AUCUN coût d'achat, AUCUNE écriture de stock.
 */
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  ADMIN: [...OPERATIONAL, P.INVOICE_DELETE, P.MEMBER_MANAGE, P.BILLING_READ],
  MANAGER: OPERATIONAL,
  STOCK_MANAGER: [
    P.DASHBOARD_READ,
    P.REPORT_READ,
    P.PRODUCT_READ,
    P.PRODUCT_WRITE,
    P.COST_VIEW,
    P.CATEGORY_WRITE,
    P.BRAND_WRITE,
    P.STOCK_READ,
    P.STOCK_WRITE,
    P.WAREHOUSE_MANAGE,
    P.SUPPLIER_READ,
    P.PURCHASE_READ,
    P.PURCHASE_RECEIVE,
    P.NOTIFICATION_READ,
    P.AI_USE,
    P.DATA_EXPORT,
  ],
  ACCOUNTANT: [
    P.DASHBOARD_READ,
    P.REPORT_READ,
    P.PRODUCT_READ,
    P.COST_VIEW,
    P.STOCK_READ,
    P.SALE_READ,
    P.SALE_CREATE,
    P.CUSTOMER_READ,
    P.SUPPLIER_READ,
    P.PURCHASE_READ,
    P.INVOICE_READ,
    P.INVOICE_WRITE,
    P.INVOICE_DELETE,
    P.EXPENSE_READ,
    P.EXPENSE_WRITE,
    P.CASH_READ,
    P.CASH_WRITE,
    P.CRM_READ,
    P.NOTIFICATION_READ,
    P.AI_USE,
    P.DATA_EXPORT,
  ],
  CASHIER: [
    P.DASHBOARD_READ,
    P.PRODUCT_READ,
    P.STOCK_READ,
    P.SALE_READ,
    P.SALE_CREATE,
    P.CUSTOMER_READ,
    P.CUSTOMER_WRITE,
    P.CASH_READ,
    P.CASH_WRITE,
    P.NOTIFICATION_READ,
    P.AI_USE,
  ],
};

/** Le propriétaire n'est jamais bloqué. Un rôle inconnu n'obtient RIEN (fail-closed). */
export function can(role: string | undefined, isOwner: boolean, permission: Permission): boolean {
  if (isOwner) return true;
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] ?? []).includes(permission);
}

export function permissionsFor(role: string | undefined, isOwner: boolean): Permission[] {
  if (isOwner) return Object.values(PERMISSIONS);
  if (!role) return [];
  return ROLE_PERMISSIONS[role] ?? [];
}
