export const paymentMethodLabels: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
  BANK_TRANSFER: 'Virement bancaire',
  CARD: 'Carte bancaire',
  OTHER: 'Autre',
};

export const invoiceDocTypeLabels: Record<string, string> = {
  INVOICE: 'Facture',
  QUOTE: 'Devis',
};

export const invoiceStatusLabels: Record<string, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyée',
  ISSUED: 'Émise',
  ACCEPTED: 'Acceptée',
  REJECTED: 'Refusée',
  EXPIRED: 'Expirée',
  PAID: 'Payée',
  PARTIALLY_PAID: 'Partiellement payée',
  OVERDUE: 'En retard',
  CANCELLED: 'Annulée',
};

export const invoiceStatusBadge: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600',
  SENT: 'bg-blue-50 text-blue-600',
  ISSUED: 'bg-indigo-50 text-indigo-600',
  ACCEPTED: 'bg-emerald-50 text-emerald-600',
  REJECTED: 'bg-red-50 text-red-600',
  EXPIRED: 'bg-amber-50 text-amber-600',
  PAID: 'bg-green-50 text-green-600',
  PARTIALLY_PAID: 'bg-yellow-50 text-yellow-700',
  OVERDUE: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-slate-100 text-slate-400',
};

export const movementLabels: Record<string, string> = {
  STOCK_IN: 'Entrée de stock',
  STOCK_OUT: 'Sortie de stock',
  ADJUSTMENT_IN: 'Ajustement +',
  ADJUSTMENT_OUT: 'Ajustement -',
  SALE: 'Vente',
  PURCHASE: 'Achat',
  TRANSFER_IN: 'Transfert entrant',
  TRANSFER_OUT: 'Transfert sortant',
  RETURN: 'Retour',
  EXPIRY_DAMAGE: 'Péremption / casse',
};

export const roleLabels: Record<string, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  CASHIER: 'Caissier',
  STOCK_MANAGER: 'Gestionnaire de stock',
  ACCOUNTANT: 'Comptable',
};

export const sectorLabels: Record<string, string> = {
  BOUTIQUE: 'Boutique',
  PHARMACIE: 'Pharmacie',
  GARAGE: 'Garage',
};

export const itemTypeLabels: Record<string, string> = {
  LABOR: 'Main d\u2019œuvre',
  PART: 'Pièce / Produit',
  OTHER: 'Autre',
};