import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Filter } from 'lucide-react';
import api from '../lib/api';
import { formatAr, formatDate, formatDateTime } from '../lib/format';
import { paymentStatusBadge, paymentStatusLabels } from '../lib/labels';
import { apiError, type Paginated } from '../lib/admin';
import { Badge, Button, Card, EmptyState, ErrorMessage, Loading, PageHeader, Select } from '../components/ui';

const ALL_STATUSES = ['', 'PENDING', 'SUCCESS', 'FAILED'];

interface PaymentRow {
  id: string;
  amountAr: number;
  status: string;
  provider: string | null;
  currency: string;
  merchantReference: string;
  providerReference: string | null;
  paidAt: string | null;
  failedAt: string | null;
  createdAt: string;
  store: { id: string; name: string };
  plan: { id: string; name: string };
}

export default function AdminPayments() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'payments', status, page],
    queryFn: async () => {
      const res = await api.get('/admin/payments', {
        params: { page, pageSize: 15, status: status || undefined },
      });
      return res.data as Paginated<PaymentRow>;
    },
  });

  return (
    <div>
      <PageHeader title="Paiements" subtitle={`${data?.total ?? 0} paiement(s)`} />

      <Card className="mb-4 p-4">
        <div className="flex items-center gap-2 max-w-sm">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">Tous les statuts</option>
            {ALL_STATUSES.slice(1).map((s) => (
              <option key={s} value={s}>{paymentStatusLabels[s] ?? s}</option>
            ))}
          </Select>
        </div>
      </Card>

      {error ? (
        <ErrorMessage message={apiError(error, 'Erreur de chargement')} />
      ) : isLoading ? (
        <Loading />
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState title="Aucun paiement" description="Aucun paiement ne correspond à ce filtre." />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100 bg-slate-50/60">
                  <th className="px-4 py-3 font-medium">Référence</th>
                  <th className="px-4 py-3 font-medium">Boutique</th>
                  <th className="px-4 py-3 font-medium">Offre</th>
                  <th className="px-4 py-3 font-medium text-right">Montant</th>
                  <th className="px-4 py-3 font-medium">Fournisseur</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Créé le</th>
                  <th className="px-4 py-3 font-medium">Payé le</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-slate-600">{p.merchantReference}</p>
                    </td>
                    <td className="px-4 py-3 font-medium text-dark-900 truncate max-w-[160px]">{p.store.name}</td>
                    <td className="px-4 py-3 text-slate-600">{p.plan.name}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAr(p.amountAr)}</td>
                    <td className="px-4 py-3 text-slate-500">{p.provider ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge className={(paymentStatusBadge[p.status] ?? 'bg-slate-100 text-slate-600')}>
                        {paymentStatusLabels[p.status] ?? p.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{formatDateTime(p.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-500">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
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
    </div>
  );
}