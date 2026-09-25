import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Store as StoreIcon, Power } from 'lucide-react';
import { toast } from 'sonner';
import api from '../lib/api';
import { formatDate, formatNumber } from '../lib/format';
import { sectorLabels, subscriptionStatusBadge, subscriptionStatusLabels } from '../lib/labels';
import { apiError, type Paginated } from '../lib/admin';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorMessage, Loading, PageHeader, SearchInput, Select } from '../components/ui';

interface StoreRow {
  id: string;
  name: string;
  sector: string;
  city: string | null;
  country: string;
  currency: string;
  active: boolean;
  createdAt: string;
  _count: { members: number; products: number; sales: number };
  subscription: { status: string; priceAr: number; currentPeriodEnd: string; plan: { name: string } } | null;
  members: { user: { fullName: string; email: string } }[];
}

export default function AdminStores() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [toggleTarget, setToggleTarget] = useState<StoreRow | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'stores', search, status, page],
    queryFn: async () => {
      const res = await api.get('/admin/stores', {
        params: { page, pageSize: 15, q: search || undefined, status: status || undefined },
      });
      return res.data as Paginated<StoreRow>;
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (row: StoreRow) => {
      const res = await api.patch(`/admin/stores/${row.id}`, { active: !row.active });
      return res.data;
    },
    onSuccess: (_data, row) => {
      toast.success(row.active ? 'Boutique désactivée' : 'Boutique activée');
      queryClient.invalidateQueries({ queryKey: ['admin', 'stores'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'overview'] });
      setToggleTarget(null);
    },
    onError: (err: unknown) => toast.error(apiError(err)),
  });

  return (
    <div>
      <PageHeader title="Boutiques" subtitle={`${data?.total ?? 0} boutique(s) sur la plateforme`} />

      <Card className="mb-4 p-4 flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Rechercher par nom ou ville..." />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="sm:w-48">
          <option value="">Tous les statuts</option>
          <option value="active">Actives</option>
          <option value="inactive">Inactives</option>
        </Select>
      </Card>

      {error ? (
        <ErrorMessage message={apiError(error, 'Erreur de chargement')} />
      ) : isLoading ? (
        <Loading />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState title="Aucune boutique" description="Aucune boutique ne correspond à cette recherche." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Boutique</th>
                  <th className="px-4 py-3 font-medium">Propriétaire</th>
                  <th className="px-4 py-3 font-medium text-right">Compteurs</th>
                  <th className="px-4 py-3 font-medium">Abonnement</th>
                  <th className="px-4 py-3 font-medium">Créée le</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white shrink-0 ${s.active ? 'bg-gradient-to-br from-emerald-500 to-teal-500' : 'bg-gradient-to-br from-slate-400 to-slate-500'}`}>
                          <StoreIcon className="w-4 h-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-dark-900 truncate">{s.name}</p>
                          <p className="text-xs text-slate-400">
                            {sectorLabels[s.sector] ?? s.sector}{s.city ? ` · ${s.city}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {s.members[0] ? (
                        <div className="min-w-0">
                          <p className="text-slate-700 truncate">{s.members[0].user.fullName}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[180px]">{s.members[0].user.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Aucun</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">
                      {formatNumber(s._count.members)} membre(s) · {formatNumber(s._count.products)} produit(s) · {formatNumber(s._count.sales)} vente(s)
                    </td>
                    <td className="px-4 py-3">
                      {s.subscription ? (
                        <Badge className={`${(subscriptionStatusBadge[s.subscription.status] ?? 'bg-slate-100 text-slate-600')}`}>
                          {s.subscription.plan.name} · {subscriptionStatusLabels[s.subscription.status] ?? s.subscription.status}
                        </Badge>
                      ) : (
                        <span className="text-slate-400 text-xs">Aucun abonnement</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDate(s.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Badge className={s.active ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}>
                        {s.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant={s.active ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => setToggleTarget(s)}
                        disabled={toggleMutation.isPending}
                      >
                        <Power className="w-3.5 h-3.5" />
                        {s.active ? 'Désactiver' : 'Activer'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
              <span className="text-slate-500">Page {data.page} sur {data.totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Précédent</Button>
                <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)}>Suivant</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      <ConfirmDialog
        open={!!toggleTarget}
        onClose={() => setToggleTarget(null)}
        title={toggleTarget?.active ? 'Désactiver la boutique' : 'Activer la boutique'}
        message={
          toggleTarget?.active
            ? `La boutique « ${toggleTarget?.name} » ne pourra plus être accessible par ses membres. Réactivable à tout moment.`
            : `La boutique « ${toggleTarget?.name} » sera de nouveau accessible (connexion et accès aux données).`
        }
        confirmLabel={toggleTarget?.active ? 'Désactiver' : 'Activer'}
        loading={toggleMutation.isPending}
        onConfirm={() => toggleTarget && toggleMutation.mutate(toggleTarget)}
      />
    </div>
  );
}