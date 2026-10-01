import { useQuery } from '@tanstack/react-query';
import api from './api';

/**
 * Permissions du membre courant (renvoyées par GET /api/v1/permissions).
 *
 * IMPORTANT : ceci ne sert qu'à masquer l'interface. La vraie sécurité est
 * côté serveur (`requirePermission`). Tant que la requête n'est pas arrivée,
 * on suppose que tout est permis (fail-open côté UI) : le serveur refusera
 * de toute façon une action interdite.
 */
export function usePermissions() {
  const { data } = useQuery({
    queryKey: ['permissions'],
    queryFn: async () => {
      const res = await api.get('/permissions');
      return res.data as { role: string | null; isOwner: boolean; permissions: string[] };
    },
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const permissions = data?.permissions;
  const can = (permission: string) => (permissions ? permissions.includes(permission) : true);

  return {
    role: data?.role ?? null,
    isOwner: data?.isOwner ?? false,
    permissions,
    can,
    isLoaded: !!data,
  };
}

/** Route → permission requise pour y accéder (sidebar). */
export const NAV_PERMISSION: Record<string, string> = {
  '/dashboard': 'dashboard.read',
  '/reports': 'report.read',
  '/sales': 'sale.read',
  '/products': 'product.read',
  '/categories': 'product.read',
  '/brands': 'product.read',
  '/stock': 'stock.read',
  '/warehouses': 'stock.read',
  '/data-transfer': 'data.export',
  '/customers': 'customer.read',
  '/suppliers': 'supplier.read',
  '/purchases': 'purchase.read',
  '/invoices': 'invoice.read',
  '/expenses': 'expense.read',
  '/cash': 'cash.read',
  '/billing': 'billing.read',
  '/notifications': 'notification.read',
  '/settings': 'settings.write',
  '/vehicles': 'crm.read',
  '/mechanics': 'crm.read',
  '/work-orders': 'crm.read',
  '/appointments': 'crm.read',
  '/garage': 'crm.read',
  '/leads': 'crm.read',
  '/interactions': 'crm.read',
  '/reminders': 'crm.read',
};

export function permissionForPath(pathname: string): string | undefined {
  const clean = pathname.split('?')[0];
  const match = Object.keys(NAV_PERMISSION)
    .sort((a, b) => b.length - a.length)
    .find((route) => clean === route || clean.startsWith(`${route}/`));
  return match ? NAV_PERMISSION[match] : undefined;
}
